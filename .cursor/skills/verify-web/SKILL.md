---
name: verify-web
description: >-
  Usala para verificar un pull request del sitio de Neutro antes de dejarle el
  informe a Lucy. Cubre identidad del PR, instalación limpia, lint, tests,
  build sin analytics, comentarios, tope de 10 archivos, cuerpo First
  Principles, CI remoto y Playwright. En un cambio crítico suma el segundo
  verificador con Codex CLI. No mergea, no comenta y no despliega.
---

# Verification skill del sitio

Evidencia, no autoinforme. Cada puerta deja el comando, el exit code y un archivo en `evidencia/<pr>-<sha corto>/`. El informe es para Juan, vía Lucy. No es un OK de merge.

Copiá [plantilla-informe.md](plantilla-informe.md) a `informe.md` y completala. Un informe por PR.

## Rol

- Lucy lanza un verificador por PR. Hamilton es dueño de los specs fijos (Playwright, axe, e2e sin JavaScript). Esta skill los corre y adjunta el resultado. No los reescribe.
- El verificador no comenta en el PR, no publica, no mergea y no emite veredicto de merge.
- El informe queda para Lucy. El merge a `main` espera el OK explícito de Juan Gallegos.

## Prohibido

- `pnpm deploy`, `pnpm deploy:check`, `wrangler deploy`, `wrangler login`.
- Imprimir secretos. Volcar `process.env`. Leer o pegar `.dev.vars`, `.env` o cualquier archivo de secretos.
- Crear `.dev.vars` con `POSTHOG_KEY`.
- Mandar eventos reales a PostHog. No pegarle a producción. Si un redirect local apunta a `neutro.solutions`, leé status y `Location` y no sigas la respuesta.
- Pedir `/ingest` en un Worker que proxee a PostHog.
- `git push`, `gh pr comment`, `gh pr merge`, `gh pr review`, reruns de workflows.
- Commitear `evidencia/`, el spec efímero o un lockfile regenerado.
- Borrar la carpeta de evidencia al terminar. Se borra la copia descartable. La evidencia queda.

Si una salida trae un secreto, reemplazalo por `‹redactado›` antes de guardar el archivo.

## Preparación

La versión la mandan los archivos del repo, no la máquina. Lo primero, definí las tres variables del PR. `$PR` se rechaza con `case "$PR" in ''|0*|*[!0-9]*)`. El `*` de `case` no es una regex: `*[!0-9]*` agarra cualquier carácter que no sea dígito, también un salto de línea, y `0*` agarra el cero adelante. `$BASE` y `$HEAD` son SHA hexadecimales de 7 a 40 caracteres, de la base y del head, y tienen que ser un commit del checkout: `git rev-parse --verify --quiet "$X^{commit}"`. Si `$PR` cae en ese `case`, frená: si no, la carpeta queda `evidencia/-<sha>`, `evidencia/0-<sha>` o `evidencia/../x-<sha>`.

Este bloque corre en la shell de la corrida (un script, o la shell donde se pega el bloque). `[ -n "${PR:-}" ] || exit 1` corta esa shell siempre, también si es interactiva. `${PR:?...}` no se usa: en una shell interactiva imprime el aviso y sigue. Si la shell es la tuya de trabajo, `exit 1` la cierra.

```bash
[ -n "${PR:-}" ] || { printf '%s\n' 'PR vacío. Definí PR con el número del pull request.'; exit 1; }
[ -n "${BASE:-}" ] || { printf '%s\n' 'BASE vacío. Definí BASE con el SHA de la base del PR.'; exit 1; }
[ -n "${HEAD:-}" ] || { printf '%s\n' 'HEAD vacío. Definí HEAD con el SHA del head del PR.'; exit 1; }
case "$BASE" in
  *[!0-9a-fA-F]*) printf '%s\n' 'BASE no es un SHA hexadecimal.'; exit 1 ;;
esac
case "$HEAD" in
  *[!0-9a-fA-F]*) printf '%s\n' 'HEAD no es un SHA hexadecimal.'; exit 1 ;;
esac
case "$PR" in
  ''|0*|*[!0-9]*) printf '%s\n' 'PR vacío, con cero adelante o con un carácter que no es dígito.'; exit 1 ;;
esac
if [ "${#BASE}" -lt 7 ] || [ "${#BASE}" -gt 40 ] || [ "${#HEAD}" -lt 7 ] || [ "${#HEAD}" -gt 40 ]; then
  printf '%s\n' 'BASE y HEAD tienen que ser SHA hexadecimales de 7 a 40 caracteres.'
  exit 1
fi
origen="$(pwd)"
git -C "$origen" rev-parse --verify --quiet "${BASE}^{commit}" >/dev/null || { printf '%s\n' 'BASE no existe.'; exit 1; }
full_head="$(git -C "$origen" rev-parse --verify --quiet "${HEAD}^{commit}")" || { printf '%s\n' 'HEAD no existe.'; exit 1; }
sha7="$(printf '%s\n' "$full_head" | cut -c1-7)"
evidencia_abs="$origen/evidencia/${PR}-${sha7}"
mkdir -p "$evidencia_abs/trazas"
cd "$origen"
```

`$origen` es la raíz del checkout original y no cambia. `$workdir` no se asigna en este bloque: se asigna una sola vez en «Directorio de cada bloque», después del `find`, y no se reasigna. `"$evidencia_abs"` es la carpeta absoluta del informe. El `find` de entorno corre en `$origen`, antes de esa asignación.

1. Node: el contenido de [`.node-version`](../../../.node-version). Al escribir esta skill es `24.18.0`. `node -v` tiene que ser esa versión, con la `v` adelante.
2. pnpm: el campo `packageManager` de [`package.json`](../../../package.json). Al escribir esta skill es `pnpm@12.14.0`. También está pinneado en `engines.pnpm`.
3. Activá esa versión y anotá las dos salidas en `"$evidencia_abs/00-preparacion.txt"`:

```bash
corepack enable pnpm
corepack prepare "$(node -e 'process.stdout.write(require("./package.json").packageManager)')" --activate
node -v
pnpm --version
```

4. Si Node o pnpm no coinciden, frená. El resto de las puertas queda en NO VERIFICADO con ese motivo. No sigas con otra versión.
5. npm y yarn no se usan. No regeneres el lockfile. La puerta 2 instala una vez, con `--frozen-lockfile`, en `$workdir`. La puerta 13 instala otra vez, dentro de `$copia`, porque ese clone no trae `node_modules`. No son la misma instalación.
6. Nombres de archivos de entorno, en la raíz y en `apps/web`. Una ruta relativa por línea, con la carpeta. No abras el contenido. No uses `cat` ni `source`. No vuelques el entorno. La salida va a `"$evidencia_abs/00-entorno-nombres.txt"`.

```bash
cd "$origen"
{
  find . -maxdepth 1 \( -name '.env*' -o -name '.dev.vars*' \) -print
  find apps/web -maxdepth 1 \( -name '.env*' -o -name '.dev.vars*' \) -print
} | tee "$evidencia_abs/00-entorno-nombres.txt"
```

`-printf` es de GNU find y no se usa. `-print` imprime la ruta relativa (`./.env.local`, `apps/web/.env.example`) y corre en el find de macOS. `tee` la deja en pantalla y la escribe en `"$evidencia_abs/00-entorno-nombres.txt"`. El bloque «Directorio de cada bloque» corre después de este `find` y lee ese archivo. Si el archivo no está, ese bloque sale 1.

En el repo están `apps/web/.env.example` y `apps/web/.dev.vars.example`. Esos dos nombres no cuentan como archivos reales de la corrida. Cualquier otro `.env*` o `.dev.vars*` sí.

`apps/web/astro.config.mjs` no define `envDir`. El build de la raíz corre en `apps/web`. `PUBLIC_*` las lee `apps/web/src/lib/analytics.ts`.

`env -u` solo, con uno de esos archivos presente, no deja el analytics apagado. La medición y la receta están en «Mediciones en la VM del agente». No está medido si una variable que ya está en el proceso le gana al archivo. No reemplaces `env -u` por asignar las variables en vacío: esa forma no se midió.

`apps/web/wrangler.jsonc` trae `ANALYTICS_ENABLED` en `"true"`. El Worker registra `captureQrScanned` en `ctx.waitUntil` antes de devolver el redirect, y sólo si `isServerAnalyticsEnabled(env)` y `env.POSTHOG_KEY` (`apps/web/worker/index.ts`, `apps/web/worker/posthog.ts`). `isServerAnalyticsEnabled` pide `ANALYTICS_ENABLED === "true"` y la key. Sin `POSTHOG_KEY` no se manda `qr_scanned`. Con la key y el flag en `"true"`, sí. No está medido, en el Worker `neutro-web`, si sin `.dev.vars` Wrangler carga un `.env`.

Si aparece un archivo que no es uno de los dos ejemplos, la única asignación de `$workdir` (en «Directorio de cada bloque») usa el clone. No borres los archivos del árbol original y no borres los `.example`. Si no armás ese clone, el build sin analytics y todo lo que dependa del Worker local quedan NO VERIFICADO. Motivo: hay un archivo de entorno y no se garantizó que no entre en la corrida.

No exportes `POSTHOG_KEY`. No pongas `CLOUDFLARE_INCLUDE_PROCESS_ENV=true`.

## Restricciones del repo

Estas restricciones se respetan al verificar y al proponer un arreglo. El detalle está en los ADR; acá va lo que cambia la corrida.

- Máximo 10 archivos por PR. Los lockfiles no cuentan. Basenames excluidos: `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lock`, `bun.lockb`. Si hace falta un arreglo, se parte en PRs apilados ([ADR 0004](../../../docs/adr/0004-max-pr-files.md)).
- Sin comentarios en el código que se cree o se edite ([ADR 0003](../../../docs/adr/0003-no-source-comments.md)). El alcance de ese ADR es JavaScript/TypeScript y el frontmatter y los `<script>` de Astro. El HTML de plantilla y el CSS quedan afuera de oxlint. El ADR no dice que los haga cumplir, y pide no dejar prosa ahí. No habla de YAML ni de un campo `razon`. El sentido que iba en un comentario va en nombres, tipos, tests o en un doc. Esta skill es Markdown: la prosa sí va.
- pnpm, versiones exactas (`saveExact: true`) y `strictPeerDependencies: true`. `minimumReleaseAgeExclude` en `pnpm-workspace.yaml` puede rechazar una dependencia nueva muy reciente. El valor de la antigüedad mínima no está verificado en esta skill: si el install falla por eso, pegá la salida y no fuerces el lockfile.
- El sitio es estático: `output: "static"` en `apps/web/astro.config.mjs`, `build.format: "file"`, `trailingSlash: "never"`. El Worker `neutro-web` (`apps/web/worker/index.ts`, `run_worker_first`) ve cada request antes que los assets. Sirve `/f/N`, `/t`, `/ingest` y el redirect de barra final. No hay rutas SSR ni un adaptador nuevo.
- `astro preview` no ejecuta el Worker. Con el build en formato file, `/nosotros/` con barra responde 404. Eso no es un hallazgo del producto: el 301 lo hace el Worker. Las rutas de preview van sin barra final.
- El Worker local, sólo si el diff toca `apps/web/worker/` o el mapeo QR de `packages/core`, se levanta con el mismo comando de la sección Playwright: `env -u POSTHOG_KEY -u PUBLIC_POSTHOG_KEY -u PUBLIC_ANALYTICS_ENABLED pnpm --filter @neutro/web exec wrangler dev --var ANALYTICS_ENABLED:false`. Antes no puede haber un `.env*` ni un `.dev.vars*` real, o `$workdir` es el clone sin esos archivos. No lo levantes a la vez que el preview de Playwright (puerto `4173`). No uses un script de la raíz que vuelva a buildear y llame a `wrangler dev` sin `--var`.
- Analytics apagado en la corrida ([ADR 0001](../../../docs/adr/0001-analytics-off-by-default.md)). Hacen falta las dos variables de build para prender el SDK en el cliente: `PUBLIC_POSTHOG_KEY` y `PUBLIC_ANALYTICS_ENABLED` igual a `true`. En el Worker hacen falta `POSTHOG_KEY` y `ANALYTICS_ENABLED`. `wrangler.jsonc` trae `ANALYTICS_ENABLED` en `"true"` para producción. Sin `POSTHOG_KEY` no sale `qr_scanned`. No copies el secret de producción.
- La base del diff es la base declarada del PR, no siempre `main`. `staging` todavía no existe ([ADR 0006](../../../docs/adr/0006-workers-builds-delivery.md), Propuesto).
- UI, motion e Impeccable están en [`AGENTS.md`](../../../AGENTS.md). `impeccable detect` lo corre quien abre el PR. No es una puerta de este informe. No commitees `.impeccable/`, `PRODUCT.md` ni `DESIGN.md`.

## Carpeta de evidencia y directorio de trabajo

`$origen` y `"$evidencia_abs"` salen del bloque de la preparación. No los vuelvas a calcular en otro directorio. Ejemplo: `/ruta/al/checkout/evidencia/46-c140955`. `evidencia/` está en `.gitignore`. No la commitees. No la borres al final. Igual agregá archivos por nombre. `git status` al cierre no puede mostrar esa carpeta en el índice.

Adentro: `informe.md`, las salidas `.txt`, capturas `.png`, una traza por pasada en `trazas/` y, si aplica, `.webm`.

## Directorio de cada bloque

`$workdir` se asigna una sola vez, en la última línea de este bloque, y no se vuelve a asignar. La puerta 13 no lo toca. El `find` de la preparación ya escribió `"$evidencia_abs/00-entorno-nombres.txt"`.

Entra una sola rama. Si esa salida, fuera de `apps/web/.env.example` y `apps/web/.dev.vars.example`, nombra otro `.env*` o `.dev.vars*`, la rama del clone corre. Si no, `$corrida` queda en `$origen`. Las dos ramas no corren juntas.

```bash
if [ ! -f "$evidencia_abs/00-entorno-nombres.txt" ]; then
  printf '%s\n' 'falta 00-entorno-nombres.txt'
  exit 1
fi
reales="$(grep -E -v '^(apps/web/\.env\.example|apps/web/\.dev\.vars\.example)$' "$evidencia_abs/00-entorno-nombres.txt" || true)"
if [ -n "$reales" ]; then
  corrida="$(mktemp -d "${TMPDIR:-/tmp}/neutro-corrida.XXXXXX")"
  git clone --local --no-hardlinks "$origen" "$corrida"
else
  corrida="$origen"
fi
workdir="$corrida"
```

Ese clone no trae `node_modules`, `dist`, `evidencia/` ni un `.env*` o `.dev.vars*` ignorado. No enlaces el `node_modules` de `$origen`.

| Bloque                                                                 | Directorio                       |
| ---------------------------------------------------------------------- | -------------------------------- |
| `find` de entorno, identidad                                           | `$origen`                        |
| Puerta 2, lint, reglas de lint, check, test, build, Playwright, trazas | `$workdir`                       |
| Puerta 13                                                              | `$copia`, y al terminar se borra |

Cada salida se escribe en `"$evidencia_abs"`, con esa ruta absoluta. `NEUTRO_EVIDENCIA` es `"$evidencia_abs"`. No uses una `evidencia/` relativa: dentro de un clone se iría con el `rm`.

Las trazas se leen de `"$workdir/apps/web/test-results"` y se copian a `"$evidencia_abs/trazas"` antes de borrar nada.

`$copia` es sólo la puerta 13. No hagas `workdir="$copia"`. Antes de `rm -rf "$copia"`, `cd "$workdir"`. Playwright y las trazas siguen en ese directorio.

Si `$workdir` no es `$origen`, borralo recién después de esa copia de trazas. No borres `"$evidencia_abs"` ni archivos de entorno de `$origen` ni los `.example`.

## Copia de la puerta 13

Hace falta sólo para provocar el fallo de una puerta nueva. Desde cualquier directorio:

```bash
copia="$(mktemp -d "${TMPDIR:-/tmp}/neutro-copia.XXXXXX")"
git clone --local --no-hardlinks "$workdir" "$copia"
cd "$copia"
pnpm install --frozen-lockfile
```

Ese install es el de `$copia`, no el de la puerta 2. El clone no trae `node_modules`. No reasignes `$workdir`. La salida va a `"$evidencia_abs/13-falla-<puerta>.txt"`. Al terminar la puerta el cwd sigue en `$copia`. Antes de borrar: `cd "$workdir"` y después `rm -rf "$copia"`. El `.txt` queda en `"$evidencia_abs"`.

Nombres de salida:

| Archivo                              | Puerta                                          |
| ------------------------------------ | ----------------------------------------------- |
| `00-preparacion.txt`                 | Versiones                                       |
| `01-identidad.txt`                   | Identidad y lista de archivos                   |
| `02-install.txt`                     | Instalación limpia                              |
| `03-lint.txt`                        | `pnpm lint`                                     |
| `04-lint-rules.txt`                  | `pnpm test:lint-rules`                          |
| `05-check.txt`                       | `pnpm check`                                    |
| `06-test.txt`                        | `pnpm test`                                     |
| `07-build.txt`                       | Build con `turbo --force` y conteo de `posthog` |
| `08-posthog-red.txt`                 | Requests de analytics en la pasada              |
| `09-comentarios.txt`                 | Recorrido del diff                              |
| `10-archivos.txt`                    | Tope de 10                                      |
| `11-cuerpo.txt`                      | Cuerpo del PR                                   |
| `12-ci.txt`                          | CI remoto                                       |
| `13-falla-<puerta>.txt`              | Fallo provocado, una por puerta nueva           |
| `14-e2e.txt`                         | Playwright                                      |
| `00-entorno-nombres.txt`             | Nombres de `.env*` y `.dev.vars*`               |
| `trazas/<nombre>-<pasada>-trace.zip` | Traza de una pasada, sin pisar                  |
| `superficie-riesgo-codex.md`         | Superficie del verificador Codex                |
| `flujo.webm`                         | Sólo si cambia un flujo completo                |

Guardá el exit code del comando, no el de un pipe. Patrón:

```bash
cd "$workdir"
out="$evidencia_abs/NN-puerta.txt"
comando > "$out" 2>&1
code=$?
printf 'exit:%s\n' "$code" >> "$out"
```

`out` es de esa puerta. Lint usa `03-lint.txt`, las reglas `04-lint-rules.txt`, check `05-check.txt` y test `06-test.txt`. No reutilices el `out` de otra puerta.

En el informe, las últimas líneas del `.txt` y el exit. El log completo queda en el archivo.

## Puertas, en orden

Si la preparación falló, no corras estas puertas. Anotalas como NO VERIFICADO.

### 1. Identidad

Directorio: `$origen`. Comando de sólo lectura:

```bash
cd "$origen"
gh pr view "$PR" --json number,url,title,headRefName,baseRefName,headRefOid,baseRefOid,body
```

- `headRefOid` y `baseRefOid` van completos (40 caracteres) en el encabezado. El sha corto del nombre de la carpeta son los primeros 7 del head.
- Traé los dos commits al clon, sin pushear: `git fetch origin` de la rama head y de la rama base. Confirmá que el SHA local del head es el de `headRefOid`. Si la rama se movió, verificá el SHA del PR, no el tip nuevo.
- Lista de archivos: `git diff --name-only "$BASE"..."$HEAD"`. Los tres puntos van pegados al SHA de la base y al del head. Si queda un espacio en el medio, git imprime el usage y sale 129. Contá aparte los lockfiles. Guardá el exit de git.
- Una lista vacía no cierra la puerta, aunque git haya salido en 0.
- Si no hay número de PR, no inventes uno. La identidad queda incompleta y el informe no se da por cerrado.

Exit de la tabla: `0` si los dos SHA completos, el exit de git es 0, la lista tiene al menos un archivo y el número está en `01-identidad.txt`. Si falta alguno, `1`.

### 2. Instalación limpia

```bash
cd "$workdir"
pnpm install --frozen-lockfile
git status --porcelain -- pnpm-lock.yaml package-lock.json yarn.lock bun.lock bun.lockb
git diff --exit-code -- pnpm-lock.yaml
```

El directorio es `$workdir`. La salida va a `"$evidencia_abs/02-install.txt"`. Exit de `pnpm install`: `0`. Las otras dos salidas tienen que venir vacías (el `git diff` también en `0`). Si el install reescribe el lockfile, la puerta falla aunque pnpm haya salido en `0`. Este install es el de `$workdir`. La puerta 13 instala aparte, en `$copia`.

### 3. `pnpm lint`

Directorio: `$workdir`. `oxlint -A all -D neutro/no-comments .`. En este repo, lint es la política de comentarios. Exit esperado: `0`.

```bash
cd "$workdir"
out="$evidencia_abs/03-lint.txt"
pnpm lint > "$out" 2>&1
code=$?
printf 'exit:%s\n' "$code" >> "$out"
```

### 4. `pnpm test:lint-rules`

Directorio: `$workdir`. Corre `tools/oxlint/no-comments.test.js`. Exit esperado: `0`.

```bash
cd "$workdir"
out="$evidencia_abs/04-lint-rules.txt"
pnpm test:lint-rules > "$out" 2>&1
code=$?
printf 'exit:%s\n' "$code" >> "$out"
```

### 5. `pnpm check`

Directorio: `$workdir`. Typecheck (turbo: Astro, el Worker y `packages/core`). Exit esperado: `0`.

```bash
cd "$workdir"
out="$evidencia_abs/05-check.txt"
pnpm check > "$out" 2>&1
code=$?
printf 'exit:%s\n' "$code" >> "$out"
```

### 6. `pnpm test`

Directorio: `$workdir`. `turbo run test`. Corre los tests de `@neutro/web` y los de `@neutro/core`. Exit esperado: `0`.

```bash
cd "$workdir"
out="$evidencia_abs/06-test.txt"
pnpm test > "$out" 2>&1
code=$?
printf 'exit:%s\n' "$code" >> "$out"
```

En `main`, el job `Check` de `.github/workflows/ci.yml` corre `pnpm check` y después `pnpm test`. En la raíz, `pnpm test` es `turbo run test`: corre el `test` de `@neutro/web` (`apps/web/package.json`) y el de `@neutro/core`. Esta puerta igual corre ese `pnpm test` y guarda `"$evidencia_abs/06-test.txt"`. El verde remoto no reemplaza ese archivo.

### 7. Build sin analytics, y conteo de `posthog`

El directorio de trabajo es `$workdir`. El proceso de build no tiene que recibir `PUBLIC_POSTHOG_KEY` ni `PUBLIC_ANALYTICS_ENABLED`. No imprimas los valores. Si estaban en el entorno, anotá el nombre y `‹redactado›`, sacalos del proceso y seguí. El comando es el que se midió: `turbo --force` para no reusar un `dist` viejo. La salida va a `"$evidencia_abs/07-build.txt"`.

```bash
cd "$workdir"
env -u PUBLIC_POSTHOG_KEY -u PUBLIC_ANALYTICS_ENABLED pnpm exec turbo run build --filter=@neutro/web --force
```

Después, en ese `.txt`, el conteo y la lista de archivos. La búsqueda no distingue mayúsculas: el copy legal escribe `PostHog`. `rg` corre en `$workdir`, sobre el `dist` que acaba de salir.

```bash
rg -l -i -F posthog apps/web/dist
rg -o -i -F posthog apps/web/dist | wc -l
```

Si `rg` no está, el mismo criterio con `grep -R -i -F -o posthog apps/web/dist`.

- Exit del build: `0`.
- Esta puerta cuenta si la preparación no encontró un `.env*` ni un `.dev.vars*` real, o si `$workdir` es el clone sin esos archivos. Si no, queda NO VERIFICADO.
- El conteo se anota siempre. Un número mayor que cero no falla solo esta puerta.
- La búsqueda lleva `-i` porque el texto legal escribe `PostHog`. Si hay un chunk, la cadena puede ir en minúsculas.
- Las cifras de esa medición están en «Mediciones en la VM del agente». Cada corrida anota sus propios archivos. Esos números no son un piso del PR que se verifica.
- El import de `posthog-js` es dinámico ([ADR 0001](../../../docs/adr/0001-analytics-off-by-default.md)). En esa medición no hubo chunk con la cadena. No afirmes que el bundler emitió un chunk si `rg` no lo lista.
- En `07-build.txt` y en el informe, listá cada archivo con coincidencia y clasificalo: `texto legal`, `chunk JS` u `otro`.
- Hallazgo alto: un archivo JS con la key, o una request a `/ingest` o a un host de PostHog durante la pasada. La key en cualquier otro archivo de `dist` también es hallazgo alto: es un secreto. El valor no se pega: archivo y `‹redactado›`.
- La búsqueda de requests queda en `"$evidencia_abs/08-posthog-red.txt"` (puerta de Playwright). Cero requests de analytics es lo esperado en este build.

### 8. `test:dist`, sólo si el script existe

Mirá `apps/web/package.json`. Si está `test:dist`:

```bash
pnpm --filter @neutro/web test:dist
```

Si no está, la fila es NO VERIFICADO. Motivo: «spec de Hamilton ausente». No es un fallo del PR. `pnpm format:check` existe y no es puerta hasta que el equipo lo sume. No lo corras como puerta.

### 9. Sin comentarios nuevos

Recorré las líneas agregadas del diff. No alcanza con el exit de `pnpm lint`. [ADR 0003](../../../docs/adr/0003-no-source-comments.md) cubre JavaScript/TypeScript y el frontmatter y los `<script>` de Astro. El HTML de plantilla y el CSS quedan afuera. Este recorrido es de la skill: también mira `#` de comentario en YAML y `wrangler.jsonc`. El ADR 0003 no habla de YAML.

```bash
git diff -U0 --no-color "$BASE"..."$HEAD"
```

Los tres puntos van pegados. Guardá el exit de git, aparte del texto del diff.

- Sólo líneas que empiezan con `+` y no con `+++`.
- Comentario de código: `//`, `/* */`, `<!-- -->`, y `#` de comentario en YAML.
- No cuentan: texto de docs (`.md`, incluida esta skill y `AGENTS.md`), el interior de una cadena, una URL, un `#` entre comillas en YAML, ni una directiva de tooling de [ADR 0003](../../../docs/adr/0003-no-source-comments.md) (`@ts-expect-error`, `oxlint-*`, `prettier-ignore`, y el resto de esa tabla).
- Cada coincidencia va a `09-comentarios.txt` con archivo y línea. Es un hallazgo.
- Una salida vacía sólo vale como «sin comentarios» si el exit de git fue 0 y la lista de archivos del diff de la puerta 1 no está vacía. Si git salió distinto de 0, la puerta falla aunque el texto esté vacío. Un 129 es git rechazando el comando.
- Exit de la tabla: `0` sólo en ese caso y con la lista de coincidencias vacía. Si hay alguna coincidencia, `1`.

### 10. Tope de 10 archivos

El mismo script que CI:

```bash
BASE_SHA="$BASE" HEAD_SHA="$HEAD" node tools/ci/check-pr-file-count.mjs
```

Exit esperado: `0`. Más de 10 archivos contados es hallazgo alto. El tope blando de 7 a 10 no falla la puerta.

### 11. Cuerpo del PR en First Principles

Leé el `body` de la puerta 1. Ignorá los comentarios HTML `CURSOR_AGENT_PR_BODY_BEGIN` / `CURSOR_AGENT_PR_BODY_END` y el pie que agrega el agente.

Tienen que estar estos `##`, en este orden, cada uno con texto propio antes del siguiente:

1. Problema
2. Restricciones y verdades
3. Razonamiento
4. Solución
5. Trade-offs
6. Verificación

El check de CI no se exime por autor ni por label. Si un PR de bot, como Dependabot o Renovate, no trae las seis secciones, falla y el mensaje dice qué falta.

Exit: `0` si la estructura está, `1` si falta una sección, está vacía o el orden cambia. Esto no puntúa la calidad del texto. Anotá en `11-cuerpo.txt` qué sección faltó.

### 12. CI remoto del head

Sólo lectura. Escribí en `12-ci.txt` el nombre de cada check, su conclusión y el enlace al run.

```bash
gh pr view "$PR" --json statusCheckRollup,url
```

De cada check: nombre, estado, conclusión, y el enlace (`detailsUrl` o `targetUrl`). No pegues el JSON crudo si trae otra cosa.

- Conclusión verde: anotala. No es veredicto de merge.
- Rojo, cancelado o ausente: hallazgo alto. El bloqueo es de proceso. La protección de rama queda apagada ([ADR 0007](../../../docs/adr/0007-reglas-automaticas-y-verification-skill.md)).
- Pendiente: la puerta queda NO VERIFICADO con motivo «el run no terminó».
- Exit de `gh` cuando hay checks fallidos: guardalo. No relances el workflow.
- El enlace al run está en `detailsUrl` (check) o `targetUrl` (status context). Si `gh` no autentica, la puerta queda NO VERIFICADO con la salida del error, sin reintentar con un token pegado en el informe.

Checks de `main`: `Lint`, `Check`, `Build`, `Max 10 files`, y el job `Chromium` del workflow `e2e` (en GitHub el nombre puede verse como `Chromium` o `e2e / Chromium`). En `.github/workflows/ci.yml`, `Lint` corre `pnpm lint` y `pnpm test:lint-rules`, `Check` corre `pnpm check` y `pnpm test`, y `Build` corre `pnpm build` (`turbo run build --filter=@neutro/web` en la raíz; el script de `@neutro/web` es `astro build`). Ese job `Build` no hace `unset` ni `env -u`. `e2e` corre en `pull_request` y en `push` a `main` si el diff toca `apps/web/**`, `packages/**`, `pnpm-lock.yaml` o `.github/workflows/e2e.yml`. Antes de su `pnpm build` hace `unset PUBLIC_POSTHOG_KEY` y `unset PUBLIC_ANALYTICS_ENABLED`, y después instala sólo Chromium. Si el workflow no se disparó por los paths, anotá «no aplica por paths» con el enlace al PR. Esa fila no es un verde.

### 13. La puerta nueva falla cuando tiene que fallar

Sólo para una puerta que este PR agrega o cambia (un workflow, una regla de lint, un script de `tools/ci`, un spec que pasa a ser contrato). Si el PR no toca ninguna puerta, la fila es `no aplica` y el motivo es ese. No fabriques un fallo para lint o para el tope de 10 en un PR que no los cambia.

Procedimiento. El directorio es `$copia`. No asignes ese path a `$workdir`.

1. Creá `$copia` con el comando de «Copia de la puerta 13». El `pnpm install --frozen-lockfile` de ese bloque corre en `$copia`.
2. Provocá el fallo mínimo de esa puerta, adentro de `$copia`. No pushees. No uses producción.
3. Corré sólo esa puerta, con `cd "$copia"`. El exit tiene que ser distinto de `0`.
4. Guardá la salida en `"$evidencia_abs/13-falla-<puerta>.txt"`, con el exit.
5. `cd "$workdir"` y después `rm -rf "$copia"`. El `.txt` queda en `"$evidencia_abs"`. El `cd` va antes del `rm`: si el cwd sigue adentro de `$copia`, el próximo comando sale 128.

Provocación mínima, cuando la puerta es una de estas:

| Puerta                    | Qué se cambia en la copia                                                 |
| ------------------------- | ------------------------------------------------------------------------- |
| `pnpm lint`               | Una línea `// puerta` en un `.ts` que oxlint ve                           |
| `pnpm test:lint-rules`    | Una aserción del test de la regla, invertida                              |
| `pnpm check`              | `const n: number = "x"` en un `.ts` del programa                          |
| `pnpm test`               | Una aserción que no puede cumplirse, en un archivo que el script ya lista |
| Build con `turbo --force` | Un import a un módulo que no existe                                       |
| Tope de 10                | Once archivos contados y el script de CI                                  |
| `test:e2e`                | El título esperado del humo, cambiado                                     |
| Install congelado         | Una dependencia en `package.json` sin tocar el lockfile                   |

Si la puerta nueva no tiene comando (es un recorrido de esta skill), el `.txt` muestra el diff mínimo y la coincidencia que el recorrido marca. Eso no es un exit de CI: VERIFICADO sólo si el `.txt` muestra el fallo. Si no lo hiciste, NO VERIFICADO.

## Playwright

Base de la prueba del sitio construido. Los specs viven en `apps/web/e2e/`. En main está `apps/web/e2e/humo.spec.ts`. Hamilton suma después, sin que esta skill se reescriba: `trabajo-sin-js.spec.ts`, `trabajo-cargar-mas.spec.ts`, `a11y.spec.ts`, `a11y-rutas.ts`, `analytics-apagado.spec.ts`. `pnpm --filter @neutro/web test:e2e` corre lo que haya en ese directorio.

El servidor del config es `astro preview` en `http://127.0.0.1:4173`. No es el Worker. No reutilices un preview de otra rama: si el puerto está tomado, liberá el puerto y volvé a lanzar el test contra el `dist` de la puerta 7.

```bash
cd "$workdir"
pnpm --filter @neutro/web exec playwright install --with-deps chromium
pnpm --filter @neutro/web exec playwright test --trace on
```

- Un solo browser: Chromium. No instales el resto.
- Exit esperado: `0`. Salida en `"$evidencia_abs/14-e2e.txt"`.
- El directorio es `$workdir`. Playwright vacía `apps/web/test-results/` al arrancar una corrida nueva. Antes de la pasada de capturas, copiá cada traza del e2e a `"$evidencia_abs/trazas"`. El nombre es `<nombre>-<pasada>-trace.zip`. `<nombre>` es el directorio de `test-results` que contiene ese zip. `$pasada` entra al bloque desde afuera: `1` para el e2e, `2` para las capturas, y el número siguiente para otra pasada. El bloque no le asigna `1`. Si no hay ninguna traza, si el destino ya existe, o si `cp` falla, la puerta sale `1` y no pisa el archivo.

```bash
cd "$workdir"
traza_exit=0
traza_n=0
if [ -z "${pasada:-}" ]; then
  printf 'pasada vacía\n' >> "$evidencia_abs/14-e2e.txt"
  traza_exit=1
else
  while IFS= read -r zip; do
    traza_n=$((traza_n + 1))
    nombre="$(basename "$(dirname "$zip")")"
    dest="$evidencia_abs/trazas/${nombre}-${pasada}-trace.zip"
    if [ -e "$dest" ]; then
      printf 'traza ya existe: %s\n' "$dest" >> "$evidencia_abs/14-e2e.txt"
      traza_exit=1
    else
      if ! cp "$zip" "$dest"; then
        printf 'cp falló: %s\n' "$dest" >> "$evidencia_abs/14-e2e.txt"
        traza_exit=1
      fi
    fi
  done < <(find "$workdir/apps/web/test-results" -name trace.zip -print)
  if [ "$traza_n" -eq 0 ]; then
    printf 'no hay traza para la pasada %s\n' "$pasada" >> "$evidencia_abs/14-e2e.txt"
    traza_exit=1
  fi
fi
printf 'exit:%s\n' "$traza_exit" >> "$evidencia_abs/14-e2e.txt"
test "$traza_exit" -eq 0
```

- Descomprimí cada traza ya copiada y buscá `posthog` y `/ingest` en los archivos de red. El conteo va a `"$evidencia_abs/08-posthog-red.txt"`. Cero es lo esperado. Antes de guardar esa salida, aplicá la regla de ocultar URLs.
- Rutas del humo, sin barra final. Una 404 en `/nosotros/` contra este servidor no es hallazgo.
- Si el diff toca el Worker o el mapeo QR: cerrá el preview de Playwright. No vuelvas a buildear. El build ya está en la puerta 7. Hace falta la previa de la preparación: ningún `.env*` ni `.dev.vars*` real, o `$workdir` es el clone sin esos archivos. El comando es el mismo de las restricciones:

```bash
cd "$workdir"
env -u POSTHOG_KEY -u PUBLIC_POSTHOG_KEY -u PUBLIC_ANALYTICS_ENABLED pnpm --filter @neutro/web exec wrangler dev --var ANALYTICS_ENABLED:false
```

El comando corre en `$workdir`, con `cd "$workdir"`. `--var` está en el CLI de `wrangler dev`: un par `clave:valor` que se inyecta al script. Hace falta porque `wrangler.jsonc` trae `ANALYTICS_ENABLED` en `"true"`. Una medición anterior vio que un `.dev.vars` de prueba dejaba la key cargada aunque `--var` pusiera el flag en `false`. Por eso esta pasada no admite un `.dev.vars` real y no lo crea. La receta está en «Mediciones en la VM del agente». Eso no está medido en el Worker del repo.

Leé la URL que imprime Wrangler. El puerto no está fijado en `wrangler.jsonc`. Si esta corrida garantiza que `POSTHOG_KEY` no está en el proceso ni en un archivo cargado, probá en local el status y los headers de `/f/N` y de una ruta con barra. Si no lo podés garantizar, no pidas `/f/N`. No sigas un `Location` hacia producción. No pidas `/ingest`. Marcalo como simulado.

### PR visual

Si el diff cambia algo que se ve, además del `test:e2e`:

- Una captura por ruta afectada, en claro y oscuro, en móvil y en escritorio. Cuatro PNG por ruta: `{slug}-light-escritorio.png`, `{slug}-light-movil.png`, `{slug}-dark-escritorio.png`, `{slug}-dark-movil.png`.
- Escritorio: 1280×720. Móvil: 390×844.
- El tema sale de `localStorage` con la clave `neutro-theme` (`light` o `dark`), puesta antes de que cargue la página. El script de `base.astro` la lee y pone la clase `dark` en `documentElement` cuando el valor es `dark`. Sumá `colorScheme` del mismo valor para el primer paint.
- Ruta afectada: la página que el diff toca. Si el diff toca un layout compartido, las rutas públicas del sitemap construido (`apps/web/dist/sitemap-index.xml` y los sitemap que ese índice enlace). Compará esa lista con `apps/web/src/pages/` y pegala en la evidencia. Una diferencia no es hallazgo de producto mientras el contrato SEO no esté en el repo: va a NO VERIFICADO con motivo «contrato SEO ausente».
- El spec de capturas es efímero. Va en `apps/web/e2e/capturas.efimero.spec.ts`, sin comentarios, y se borra aunque el run falle. No se commitea. `NEUTRO_EVIDENCIA` es `"$evidencia_abs"`. `NEUTRO_RUTAS` es la lista separada por comas. Corré ese archivo desde `$workdir`, con `--trace on`, y después borralo. `git status` no puede mostrar el spec.

```ts
import { expect, test } from "@playwright/test";

const evidencia = process.env.NEUTRO_EVIDENCIA;
const routes = (process.env.NEUTRO_RUTAS ?? "/").split(",");

if (!evidencia) {
  throw new Error("NEUTRO_EVIDENCIA es obligatoria");
}

const themes = ["light", "dark"] as const;
const viewports = [
  { name: "escritorio", width: 1280, height: 720 },
  { name: "movil", width: 390, height: 844 },
] as const;

for (const route of routes) {
  for (const theme of themes) {
    for (const viewport of viewports) {
      const slug =
        route === "/" ? "home" : route.replaceAll("/", "_").replace(/^_/, "");
      test(`${slug} ${theme} ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await page.emulateMedia({ colorScheme: theme });
        await page.addInitScript((value) => {
          localStorage.setItem("neutro-theme", value);
        }, theme);
        const response = await page.goto(route);
        expect(response?.ok(), route).toBe(true);
        await page.screenshot({
          path: `${evidencia}/${slug}-${theme}-${viewport.name}.png`,
          fullPage: true,
        });
      });
    }
  }
}
```

- Si el diff toca motion o el video de la home, sumá una captura con `prefers-reduced-motion: reduce`. Nombre: `{slug}-reduce-{viewport}.png`. Si el diff no lo toca, la fila es `no aplica` con ese motivo. El contrato de las `<source>` del video ya está en `video-section.test.ts`, que corre con `pnpm test`.
- Axe, teclado, foco y la pasada sin JavaScript los cubren los specs de Hamilton cuando existan. Si el archivo no está, esa fila queda NO VERIFICADO con motivo «spec de Hamilton ausente». No armes un segundo checklist paralelo.
- Las trazas de las capturas se copian después, desde `$workdir`, con el mismo bucle. Antes del bucle, `pasada=2`. Playwright ya vació `test-results/` al arrancar esa pasada: las del e2e tienen que estar en `"$evidencia_abs/trazas"` desde antes. Una pasada posterior asigna el número siguiente y usa el mismo bucle. Si no hay trazas, si `<nombre>-<pasada>-trace.zip` ya existe, o si `cp` falla, esa copia sale `1` y no pisa el archivo.

### Video de un flujo completo

Sólo si el PR cambia un flujo completo (más de un paso con interacción). Un cambio visual estático no lleva video.

- Config efímero, sin comentarios, que toma `apps/web/playwright.config.ts` y pone `use.video` en `"on"` y `use.trace` en `"on"`. Conservá el `webServer` del config de main.
- Corré el flujo desde `$workdir`, copiá el `.webm` a `"$evidencia_abs/flujo.webm"`, borrá el config y el spec.
- Si no cambia un flujo, la fila es `no aplica`.

## Cambio crítico

Cambio crítico: todo lo que no sea visual ni CI/CD y pueda tocar base de datos, infraestructura crítica o seguridad.

«Toque» quiere decir que el diff modifica el contenido de ese archivo o de esa configuración. Mencionarlo en prosa no cuenta.

En este repo entran, entre otros: el Worker, `wrangler.jsonc`, headers, secretos, variables `PUBLIC_*` o `POSTHOG_KEY`, auth, permisos, datos, migraciones y dependencias que cambian la superficie. Un PR mezclado entra por la parte que no es visual.

Docs de reglas y lint no suman el verificador con Codex, salvo que el diff modifique el contenido de secretos, tokens, protección de rama o env vars. En ese caso sí lo suman. CI y deploy son CI/CD: esta regla no los usa para sumar el verificador. El resto de la sección de cambio crítico se corre igual en esos PR.

Un PR que sólo cambia CI no necesita verificación con codex. No suma el verificador de Codex. Sigue con el verificador normal de Lucy. Codex queda para un cambio crítico que no es CI.

Esta regla de exclusión está vigente.

Si el cambio crítico no aplica, en el informe: «Cambio crítico: no aplica», con una frase de motivo. El resto de esta sección no se corre. Un PR de docs de reglas, de lint, o que sólo cambia CI, no usa esa salida: la sección se corre. El verificador con Codex entra sólo con la excepción de arriba. Un PR que sólo cambia CI no lo suma y sigue con el verificador normal de Lucy.

### Superficie, antes de verificar

Escribí `superficie-riesgo.md` antes de correr las puertas de esta sección. Qué toca el diff: tablas, bindings, secretos, rutas, headers, permisos, dependencias. Qué queda afuera. El segundo verificador escribe la suya, `superficie-riesgo-codex.md`, sin ver la primera.

### Segundo verificador

El segundo verificador sigue la regla de arriba. Un PR que sólo cambia CI no lo suma: la fila queda en `no aplica` y no se abre la sesión.

Cuando el cambio es crítico según esa regla, otra sesión de Codex CLI, con esfuerzo high. El modelo es el que ese CLI tenga configurado.

Recibe el diff `"$BASE"..."$HEAD"`, esta skill y la plantilla. No recibe `informe.md`, los hallazgos ni la superficie del primero. Una sola sesión de chat no sirve para los dos.

Escribe `informe-codex.md` en la misma carpeta. Cuando los dos informes están en disco, las discrepancias se agregan como hallazgos abiertos, severidad alta, sin borrar ni reescribir el informe del segundo. Un hallazgo que sólo vio uno de los dos queda abierto.

Si el CLI no está, esta parte queda NO VERIFICADO. No se simula el segundo pase y el cambio crítico no se da por cerrado.

### Pruebas negativas

Obligatorias para la superficie declarada. Tienen que fallar cerrado. Guardá exit y salida.

- Entrada inválida. En este repo, un id QR que no está en la tabla: el redirect sigue sin armar un evento.
- Sin permiso. Es un caso aparte. Si la superficie tiene permisos, una llamada sin ese permiso tiene que fallar cerrada. Si el diff no toca permisos, la fila es `no aplica` con ese motivo. No la juntes con la variable ausente.
- Sin la variable. Otro caso. Sin `POSTHOG_KEY`, el redirect de `/f/N` responde y no se llama `captureQrScanned`. Sólo si la ausencia de la key está garantizada, como en la pasada del Worker local.
- Variable ausente en el build: la puerta 7, si la superficie incluye analytics.

No inventes una negativa de un sistema que el diff no toca. Si no hay caso cerrado, es NO VERIFICADO con motivo, no un pasa.

### Seguridad y dependencias

- Buscá secretos en el diff y en `apps/web/dist`. Nombres típicos: `POSTHOG_KEY`, `PUBLIC_POSTHOG_KEY`, tokens, `phc_`. Anotá archivo y línea. El valor es `‹redactado›`.
- Dependencias nuevas o bumpeadas: versión exacta, que el lockfile la fije, y de qué registro salen. `saveExact` tiene que cumplirse.
- Headers que el diff toca (`X-Robots-Tag`, cache, status del redirect).
- Variables `PUBLIC_*` que quedan en el cliente: listá los nombres. En esta corrida no tiene que quedar el valor de `PUBLIC_POSTHOG_KEY`.

### Migraciones

Si hay migración o cambio de esquema: probá la ida y la reversa en un entorno descartable. Nunca contra producción. En el informe, el host y el nombre de la base, y una frase que confirme que no eran datos reales.

Si el diff no tiene esquema, la fila es `no aplica`.

### Simulado y verificado

- Simulado: `astro preview`, `wrangler dev`, mocks, tests locales, la copia descartable.
- Verificado: lo que se ejecutó y se vio en esta corrida (exit, archivo, captura). El estado del CI remoto está verificado como estado de GitHub, no como comportamiento de producción.
- Producción no se toca. Nada del informe es «verificado en producción» por defecto.

### Qué decide Juan

Cerrá el informe con la lista de decisiones que el diff le deja a Juan Gallegos. No incluyas un «se puede mergear». El OK de merge no sale de este informe.

## Formato del informe

Un solo `informe.md` por PR, con la plantilla.

- Encabezado de identidad: número, URL, ramas, SHA completo de head y de base, cantidad de archivos (lockfile aparte) y la lista.
- Hallazgos numerados. Cada uno: severidad (alta, media, baja), `archivo:líneas @ commit corto`, qué pasa, qué se esperaba, evidencia. El commit corto son 7 caracteres del commit donde están esas líneas, casi siempre el head. Si no hay hallazgos, la sección dice exactamente `sin hallazgos`. Si hay, reemplazá esa línea por la lista.
- Tabla de puertas: puerta, comando, exit code, enlace al archivo de evidencia.
- VERIFICADO, un bloque por ítem: comando ejecutado, salida literal o recorte, exit code. NO VERIFICADO, un bloque por ítem: comando ejecutado, salida literal o recorte, exit code, qué faltó y por qué.
- En la evidencia, ocultá hosts de analytics, URLs de producción con parámetros y cualquier key: reemplazalos por `‹redactado›`. Los links públicos del sitio, sin parámetros, se dejan. Un `https://neutro.solutions/nosotros` queda. Un `https://neutro.solutions/` con query string no. Un host que contenga `posthog` no.
- Secretos y datos personales como `‹redactado›`.
- Sin veredicto de merge.

Severidad, para no dispersar:

- Alta: puerta en rojo, secreto, archivo JS con la key, comentario nuevo en código de aplicación, más de 10 archivos, request de analytics, discrepancia entre los dos verificadores.
- Media: CI pendiente, comentario en YAML o CSS, cuerpo del PR incompleto.
- Baja: desvío que no rompe una puerta y queda acotado a un archivo.

## Mediciones en la VM del agente

No es una puerta. No la corras sobre el PR que estás verificando. Es la receta de lo medido el 2026-10-26 en la VM del agente. Wrangler 4.151.2. Astro 7.4.1. Node 24.18.0. pnpm 12.14.0. Turbo 2.11.9. Esas cifras no son un piso de otro PR.

Los conteos 4, 6 y 10 salieron del commit `10c8231a53d42d29edf28978dee0fea3bc837f3a`. Antes del build, en esa VM ya estaba el `pnpm install --frozen-lockfile`. Para repetirlo, desde un clone de ese commit y con sólo `apps/web/.env.example` y `apps/web/.dev.vars.example`:

```bash
pnpm install --frozen-lockfile
env -u PUBLIC_POSTHOG_KEY -u PUBLIC_ANALYTICS_ENABLED pnpm exec turbo run build --filter=@neutro/web --force
rg -l -i -F posthog apps/web/dist
rg -o -i -F posthog apps/web/dist/cookies.html | wc -l
rg -o -i -F posthog apps/web/dist/privacidad.html | wc -l
rg -l -F posthog apps/web/dist
rg -l -i -F posthog apps/web/dist -g '*.js'
```

Esa corrida: exit 0 del build. `rg -l -i` listó `apps/web/dist/privacidad.html` y `apps/web/dist/cookies.html`. Ocurrencias: 4, 6 y 10 en total. `rg -l -F posthog` salió 1. El `rg` de `*.js` salió 1. Ningún `.js` tenía la cadena.

Vite, un archivo por vez, el mismo `env -u` y `--force`. La key de prueba no es un secreto. Borrá el archivo al terminar y no lo commitees. Repetí con `apps/web/.env`, `apps/web/.env.local`, `apps/web/.env.production` y `apps/web/.env.production.local`:

```bash
printf '%s\n' 'PUBLIC_ANALYTICS_ENABLED=true' 'PUBLIC_POSTHOG_KEY=phc_probe_not_a_real_key' > apps/web/.env.production
env -u PUBLIC_POSTHOG_KEY -u PUBLIC_ANALYTICS_ENABLED pnpm exec turbo run build --filter=@neutro/web --force
rg -l -F phc_probe_not_a_real_key apps/web/dist
rm -f apps/web/.env.production
```

Las cuatro: exit 0 del build y `rg -l` exit 0, un `.js` en `apps/web/dist/_astro`. No está medido si una variable que ya está en el proceso le gana al archivo.

Wrangler, en un directorio temporal, no en `neutro-web`. No crees `.dev.vars`. No pidas `/f/N` ni `/ingest`. No pegues la key.

Requisitos de esta receta, antes de correrla: Node >= 22 (esta skill usa `24.18.0`, el de `.node-version`) y `python3` en el `PATH`. Sin los dos, no arranques Wrangler. El binario es `"$workdir/apps/web/node_modules/.bin/wrangler"`, Wrangler 4.151.2, después del `pnpm install --frozen-lockfile` de arriba. En un clone no existe `$origen/apps/web/node_modules`: no lo uses.

Antes de levantar Wrangler, desde `$workdir`, listá que no hay `.dev.vars`. Si imprime una ruta, no arranques.

```bash
cd "$workdir"
find "$workdir" "$workdir/apps/web" -maxdepth 1 -name '.dev.vars' -print
```

Salida esperada: ninguna línea. Exit: `0`. El 2026-10-26, en el checkout de la VM, ese `find` no imprimió nada y salió `0`.

El puerto sale libre en el momento. `wrangler dev` va en segundo plano. El PID queda en `$wrangler_pid`. Al final, `kill` y `wait`. `wait` después de `kill` sale distinto de `0`. Ese exit no es el resultado: el resultado es el body del `curl`.

```bash
probe="$(mktemp -d "${TMPDIR:-/tmp}/neutro-var-probe.XXXXXX")"
wrangler="$workdir/apps/web/node_modules/.bin/wrangler"
puerto="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()')"
printf '%s\n' 'export default { async fetch(_request, env) { return Response.json({ analyticsEnabled: env.ANALYTICS_ENABLED ?? null, posthogKeyPresent: Boolean(env.POSTHOG_KEY) }); } };' > "$probe/index.js"
printf '%s\n' '{ "name": "var-probe", "main": "index.js", "compatibility_date": "2026-10-01", "vars": { "ANALYTICS_ENABLED": "true" } }' > "$probe/wrangler.jsonc"
cd "$probe"
env -u POSTHOG_KEY "$wrangler" dev --port "$puerto" --ip 127.0.0.1 --var ANALYTICS_ENABLED:false --var POSTHOG_KEY:phc_probe_not_a_real_key > "$probe/wrangler.log" 2>&1 &
wrangler_pid=$!
listo=0
intento=0
while [ "$intento" -lt 40 ]; do
  if curl -sf "http://127.0.0.1:${puerto}/" >/dev/null; then
    listo=1
    break
  fi
  intento=$((intento + 1))
  sleep 1
done
if [ "$listo" -ne 1 ]; then
  printf '%s\n' 'wrangler no respondió'
  kill "$wrangler_pid"
  wait "$wrangler_pid"
  exit 1
fi
printf '%s\n' "$(curl -sS "http://127.0.0.1:${puerto}/")"
kill "$wrangler_pid"
wait_exit=0
wait "$wrangler_pid" || wait_exit=$?
printf 'wait:%s\n' "$wait_exit"
```

Esa forma, el 2026-10-26, con Node 24.18.0 y Wrangler 4.151.2, eligió el puerto 57329. El log no dijo que usara `.dev.vars`. `--var` metió la key de prueba. El flag quedó en `false`. La salida real va en dos bloques: el body, y después `wait`.

Body:

```text
{"analyticsEnabled":"false","posthogKeyPresent":true}
```

```text
wait:143
```

La segunda pasada usa el mismo `$probe` y el mismo `$wrangler`, otro puerto libre, sólo `--var ANALYTICS_ENABLED:false` y `env -u POSTHOG_KEY`.

```bash
puerto="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()')"
cd "$probe"
env -u POSTHOG_KEY "$wrangler" dev --port "$puerto" --ip 127.0.0.1 --var ANALYTICS_ENABLED:false > "$probe/wrangler-b.log" 2>&1 &
wrangler_pid=$!
listo=0
intento=0
while [ "$intento" -lt 40 ]; do
  if curl -sf "http://127.0.0.1:${puerto}/" >/dev/null; then
    listo=1
    break
  fi
  intento=$((intento + 1))
  sleep 1
done
if [ "$listo" -ne 1 ]; then
  printf '%s\n' 'wrangler no respondió'
  kill "$wrangler_pid"
  wait "$wrangler_pid"
  exit 1
fi
printf '%s\n' "$(curl -sS "http://127.0.0.1:${puerto}/")"
kill "$wrangler_pid"
wait_exit=0
wait "$wrangler_pid" || wait_exit=$?
printf 'wait:%s\n' "$wait_exit"
```

Esa pasada eligió el puerto 33893. El log listó sólo el binding `ANALYTICS_ENABLED`.

Body:

```text
{"analyticsEnabled":"false","posthogKeyPresent":false}
```

```text
wait:143
```

Una corrida anterior del mismo día, en primer plano, vio los mismos bodies en los puertos 53809 y 45061. Otra, con un `.dev.vars` temporal, vio la key cargada aunque `--var` pusiera el flag en `false`. Esa receta con archivo no se repite: esta skill no crea `.dev.vars` con `POSTHOG_KEY`. No está medido en el Worker del repo. Borrá `$probe` al terminar.

## Arreglos

Si el informe propone un arreglo, el arreglo va en otro PR, apilado, dentro del tope de 10 archivos y sin comentarios. Esta corrida no lo commitea, no lo publica y no lo mergea.
