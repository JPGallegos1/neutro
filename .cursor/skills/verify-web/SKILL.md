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

La versión la mandan los archivos del repo, no la máquina. Lo primero, parado en la raíz del checkout original y antes de cualquier clone:

```bash
origen="$(pwd)"
sha7="$(git -C "$origen" rev-parse HEAD | cut -c1-7)"
evidencia_abs="$origen/evidencia/${PR}-${sha7}"
mkdir -p "$evidencia_abs/trazas"
cd "$origen"
```

`$origen` es esa raíz. `"$evidencia_abs"` es la carpeta absoluta del informe. El `find` de entorno corre ahí, antes de decidir la copia.

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
5. npm y yarn no se usan. No regeneres el lockfile. La instalación de la puerta 2 es la única de la corrida, va con `--frozen-lockfile` y corre en `$workdir`. Si hay copia descartable, no hay un segundo install en el checkout original.
6. Nombres de archivos de entorno, en la raíz y en `apps/web`. Una ruta relativa por línea, con la carpeta. No abras el contenido. No uses `cat` ni `source`. No vuelques el entorno. La salida va a `"$evidencia_abs/00-entorno-nombres.txt"`.

```bash
cd "$origen"
find . -maxdepth 1 \( -name '.env*' -o -name '.dev.vars*' \) -print
find apps/web -maxdepth 1 \( -name '.env*' -o -name '.dev.vars*' \) -print
```

`-printf` es de GNU find y no se usa. `-print` imprime la ruta relativa (`./.env.local`, `apps/web/.env.example`) y corre en el find de macOS.

En el repo están `apps/web/.env.example` y `apps/web/.dev.vars.example`. Esos dos nombres no cuentan como archivos reales de la corrida. Cualquier otro `.env*` o `.dev.vars*` sí.

`apps/web/astro.config.mjs` no define `envDir`. El build de la raíz corre en `apps/web`. `PUBLIC_*` las lee `apps/web/src/lib/analytics.ts`.

`env -u` solo, con uno de esos archivos presente, no deja el analytics apagado. La medición y la receta están en «Mediciones en la VM del agente». No está medido si una variable que ya está en el proceso le gana al archivo. No reemplaces `env -u` por asignar las variables en vacío: esa forma no se midió.

`apps/web/wrangler.jsonc` trae `ANALYTICS_ENABLED` en `"true"`. El Worker registra `captureQrScanned` en `ctx.waitUntil` antes de devolver el redirect, y sólo si `isServerAnalyticsEnabled(env)` y `env.POSTHOG_KEY` (`apps/web/worker/index.ts`, `apps/web/worker/posthog.ts`). `isServerAnalyticsEnabled` pide `ANALYTICS_ENABLED === "true"` y la key. Sin `POSTHOG_KEY` no se manda `qr_scanned`. Con la key y el flag en `"true"`, sí. No está medido, en el Worker `neutro-web`, si sin `.dev.vars` Wrangler carga un `.env`.

Si aparece un archivo que no es uno de los dos ejemplos, seguí en la copia descartable. No borres los del árbol original y no borres los `.example`. Si no armás esa copia, el build sin analytics y todo lo que dependa del Worker local quedan NO VERIFICADO. Motivo: hay un archivo de entorno y no se garantizó que no entre en la corrida.

No exportes `POSTHOG_KEY`. No pongas `CLOUDFLARE_INCLUDE_PROCESS_ENV=true`.

## Restricciones del repo

Estas restricciones se respetan al verificar y al proponer un arreglo. El detalle está en los ADR; acá va lo que cambia la corrida.

- Máximo 10 archivos por PR. Los lockfiles no cuentan. Basenames excluidos: `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lock`, `bun.lockb`. Si hace falta un arreglo, se parte en PRs apilados ([ADR 0004](../../../docs/adr/0004-max-pr-files.md)).
- Sin comentarios en el código que se cree o se edite ([ADR 0003](../../../docs/adr/0003-no-source-comments.md)). El alcance de ese ADR es JavaScript/TypeScript y el frontmatter y los `<script>` de Astro. El HTML de plantilla y el CSS quedan afuera de oxlint. El ADR no dice que los haga cumplir, y pide no dejar prosa ahí. No habla de YAML ni de un campo `razon`. El sentido que iba en un comentario va en nombres, tipos, tests o en un doc. Esta skill es Markdown: la prosa sí va.
- pnpm, versiones exactas (`saveExact: true`) y `strictPeerDependencies: true`. `minimumReleaseAgeExclude` en `pnpm-workspace.yaml` puede rechazar una dependencia nueva muy reciente. El valor de la antigüedad mínima no está verificado en esta skill: si el install falla por eso, pegá la salida y no fuerces el lockfile.
- El sitio es estático: `output: "static"` en `apps/web/astro.config.mjs`, `build.format: "file"`, `trailingSlash: "never"`. El Worker `neutro-web` (`apps/web/worker/index.ts`, `run_worker_first`) ve cada request antes que los assets. Sirve `/f/N`, `/t`, `/ingest` y el redirect de barra final. No hay rutas SSR ni un adaptador nuevo.
- `astro preview` no ejecuta el Worker. Con el build en formato file, `/nosotros/` con barra responde 404. Eso no es un hallazgo del producto: el 301 lo hace el Worker. Las rutas de preview van sin barra final.
- El Worker local, sólo si el diff toca `apps/web/worker/` o el mapeo QR de `packages/core`, se levanta con el mismo comando de la sección Playwright: `env -u POSTHOG_KEY -u PUBLIC_POSTHOG_KEY -u PUBLIC_ANALYTICS_ENABLED pnpm --filter @neutro/web exec wrangler dev --var ANALYTICS_ENABLED:false`. Antes no puede haber un `.env*` ni un `.dev.vars*` real, o la corrida es la copia descartable. No lo levantes a la vez que el preview de Playwright (puerto `4173`). No uses un script de la raíz que vuelva a buildear y llame a `wrangler dev` sin `--var`.
- Analytics apagado en la corrida ([ADR 0001](../../../docs/adr/0001-analytics-off-by-default.md)). Hacen falta las dos variables de build para prender el SDK en el cliente: `PUBLIC_POSTHOG_KEY` y `PUBLIC_ANALYTICS_ENABLED` igual a `true`. En el Worker hacen falta `POSTHOG_KEY` y `ANALYTICS_ENABLED`. `wrangler.jsonc` trae `ANALYTICS_ENABLED` en `"true"` para producción. Sin `POSTHOG_KEY` no sale `qr_scanned`. No copies el secret de producción.
- La base del diff es la base declarada del PR, no siempre `main`. `staging` todavía no existe ([ADR 0006](../../../docs/adr/0006-workers-builds-delivery.md), Propuesto).
- UI, motion e Impeccable están en [`AGENTS.md`](../../../AGENTS.md). `impeccable detect` lo corre quien abre el PR. No es una puerta de este informe. No commitees `.impeccable/`, `PRODUCT.md` ni `DESIGN.md`.

## Carpeta de evidencia y directorio de trabajo

`$origen` y `"$evidencia_abs"` salen del bloque de la preparación. No los vuelvas a calcular en otro directorio. Ejemplo: `/ruta/al/checkout/evidencia/46-c140955`. `evidencia/` está en `.gitignore`. No la commitees. No la borres al final. Igual agregá archivos por nombre. `git status` al cierre no puede mostrar esa carpeta en el índice.

Adentro: `informe.md`, las salidas `.txt`, capturas `.png`, una traza por pasada en `trazas/` y, si aplica, `.webm`.

## Copia descartable

Hace falta si hay un `.env*` o un `.dev.vars*` que no sea uno de los dos ejemplos, o si la puerta 13 provoca un fallo. Si no hace falta, `workdir="$origen"`.

Si hace falta, desde `$origen`:

```bash
copia="$(mktemp -d "${TMPDIR:-/tmp}/neutro-copia.XXXXXX")"
git clone --local --no-hardlinks "$origen" "$copia"
workdir="$copia"
```

`$workdir` es el directorio de trabajo de todas las puertas: `cd "$workdir"` antes de install, lint, test, build y Playwright. El clone no trae `node_modules`, `dist`, `evidencia/` ni un `.env*` o `.dev.vars*` ignorado. El `pnpm install --frozen-lockfile` y el build corren ahí. Esa instalación es la única. No instales otra vez en `$origen`. No enlaces ni copies su `node_modules`.

Cada salida se escribe en `"$evidencia_abs"`, con esa ruta absoluta, nunca en una `evidencia/` relativa. Dentro de `$copia` la relativa se iría con `rm -rf "$copia"`. `NEUTRO_EVIDENCIA` es `"$evidencia_abs"`.

Las trazas se leen de `"$workdir/apps/web/test-results"` y se copian a `"$evidencia_abs/trazas"` antes de borrar la copia.

Después de esa copia, `rm -rf "$copia"`. No borres `"$evidencia_abs"` ni archivos de entorno de `$origen` ni los `.example`.

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
out="$evidencia_abs/03-lint.txt"
pnpm lint > "$out" 2>&1
code=$?
printf 'exit:%s\n' "$code" >> "$out"
```

En el informe, las últimas líneas del `.txt` y el exit. El log completo queda en el archivo.

## Puertas, en orden

Si la preparación falló, no corras estas puertas. Anotalas como NO VERIFICADO.

### 1. Identidad

Comando de sólo lectura:

```bash
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

El directorio es `$workdir`: `$origen` si no hay copia, `$copia` si la hay. La salida va a `"$evidencia_abs/02-install.txt"`. Exit de `pnpm install`: `0`. Las otras dos salidas tienen que venir vacías (el `git diff` también en `0`). Si el install reescribe el lockfile, la puerta falla aunque pnpm haya salido en `0`. Esta es la única instalación de la corrida.

### 3. `pnpm lint`

`oxlint -A all -D neutro/no-comments .`. En este repo, lint es la política de comentarios. Exit esperado: `0`.

### 4. `pnpm test:lint-rules`

Corre `tools/oxlint/no-comments.test.js`. Exit esperado: `0`.

### 5. `pnpm check`

Typecheck (turbo: Astro, el Worker y `packages/core`). Exit esperado: `0`.

### 6. `pnpm test`

`turbo run test`. Corre los tests de `@neutro/web` y los de `@neutro/core`. Exit esperado: `0`.

El job Check de CI, en la base de Playwright, corre `pnpm --filter @neutro/web test`. Un CI verde no reemplaza esta puerta: la skill pide el `pnpm test` de la raíz. Si CI no corrió core, anotalo en la tabla de CI y no lo marques como verificado por el remoto.

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
- Esta puerta cuenta si la preparación no encontró un `.env*` ni un `.dev.vars*` real, o si la corrida es la copia sin esos archivos. Si no, queda NO VERIFICADO.
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

Checks de esta base: `Lint`, `Check`, `Max 10 files`, y el job `Chromium` del workflow `e2e` (en GitHub el nombre puede verse como `Chromium` o `e2e / Chromium`). `e2e` corre si el diff toca `apps/web/**`, `packages/**`, `pnpm-lock.yaml` o `.github/workflows/e2e.yml`. Si el workflow no se disparó por los paths, anotá «no aplica por paths» con el enlace al PR. Esa fila no es un verde.

### 13. La puerta nueva falla cuando tiene que fallar

Sólo para una puerta que este PR agrega o cambia (un workflow, una regla de lint, un script de `tools/ci`, un spec que pasa a ser contrato). Si el PR no toca ninguna puerta, la fila es `no aplica` y el motivo es ese. No fabriques un fallo para lint o para el tope de 10 en un PR que no los cambia.

Procedimiento:

1. Copia descartable, con el comando de la sección «Copia descartable». No es un remote. Queda fuera de `evidencia/`.
2. Provocá el fallo mínimo de esa puerta. No pushees. No uses producción.
3. Corré sólo esa puerta. El exit tiene que ser distinto de `0`.
4. Guardá la salida en `13-falla-<puerta>.txt`, con el exit.
5. Borrá la copia. Dejá el `.txt`.

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

Base de la prueba del sitio construido. Los specs viven en `apps/web/e2e/`. Hoy la base trae `humo.spec.ts`. Hamilton suma después, sin que esta skill se reescriba: `trabajo-sin-js.spec.ts`, `trabajo-cargar-mas.spec.ts`, `a11y.spec.ts`, `a11y-rutas.ts`, `analytics-apagado.spec.ts`. `pnpm --filter @neutro/web test:e2e` corre lo que haya en ese directorio.

El servidor del config es `astro preview` en `http://127.0.0.1:4173`. No es el Worker. No reutilices un preview de otra rama: si el puerto está tomado, liberá el puerto y volvé a lanzar el test contra el `dist` de la puerta 7.

```bash
cd "$workdir"
pnpm --filter @neutro/web exec playwright install --with-deps chromium
pnpm --filter @neutro/web exec playwright test --trace on
```

- Un solo browser: Chromium. No instales el resto.
- Exit esperado: `0`. Salida en `"$evidencia_abs/14-e2e.txt"`.
- Playwright vacía `apps/web/test-results/` al arrancar una corrida nueva. Antes de la pasada de capturas, copiá cada traza del e2e a `"$evidencia_abs/trazas"`. El nombre es `<nombre>-<pasada>-trace.zip`. `<nombre>` es el directorio de `test-results` que contiene ese zip. La pasada del e2e es `1`. Si ese archivo ya existe, la puerta sale `1` y no se pisa.

```bash
cd "$workdir"
pasada=1
traza_exit=0
while IFS= read -r zip; do
  nombre="$(basename "$(dirname "$zip")")"
  dest="$evidencia_abs/trazas/${nombre}-${pasada}-trace.zip"
  if [ -e "$dest" ]; then
    printf 'traza ya existe: %s\n' "$dest" >> "$evidencia_abs/14-e2e.txt"
    traza_exit=1
  else
    cp "$zip" "$dest"
  fi
done < <(find "$workdir/apps/web/test-results" -name trace.zip -print)
printf 'exit:%s\n' "$traza_exit" >> "$evidencia_abs/14-e2e.txt"
test "$traza_exit" -eq 0
```

- Descomprimí cada traza ya copiada y buscá `posthog` y `/ingest` en los archivos de red. El conteo va a `"$evidencia_abs/08-posthog-red.txt"`. Cero es lo esperado. Antes de guardar esa salida, aplicá la regla de ocultar URLs.
- Rutas del humo, sin barra final. Una 404 en `/nosotros/` contra este servidor no es hallazgo.
- Si el diff toca el Worker o el mapeo QR: cerrá el preview de Playwright. No vuelvas a buildear. El build ya está en la puerta 7. Hace falta la previa de la preparación: ningún `.env*` ni `.dev.vars*` real, o la copia descartable. El comando es el mismo de las restricciones:

```bash
env -u POSTHOG_KEY -u PUBLIC_POSTHOG_KEY -u PUBLIC_ANALYTICS_ENABLED pnpm --filter @neutro/web exec wrangler dev --var ANALYTICS_ENABLED:false
```

El comando corre en `$workdir`. `--var` está en el CLI de `wrangler dev`: un par `clave:valor` que se inyecta al script. Hace falta porque `wrangler.jsonc` trae `ANALYTICS_ENABLED` en `"true"`. En la medición, `--var` pisó el flag y la key de un `.dev.vars` de prueba siguió cargada. Por eso esta pasada no admite un `.dev.vars` real. La receta y los bodies están en «Mediciones en la VM del agente». Eso no está medido en el Worker del repo.

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
- Las trazas de las capturas se copian después, con el mismo bucle y `pasada=2`, a `"$evidencia_abs/trazas"`. Playwright ya vació `test-results/` al arrancar esa pasada: las del e2e tienen que estar copiadas desde antes. Una pasada posterior usa el número siguiente. Si `<nombre>-<pasada>-trace.zip` ya existe, esa copia sale `1` y no pisa el archivo.

### Video de un flujo completo

Sólo si el PR cambia un flujo completo (más de un paso con interacción). Un cambio visual estático no lleva video.

- Config efímero, sin comentarios, que toma `apps/web/playwright.config.ts` y pone `use.video` en `"on"` y `use.trace` en `"on"`. Conservá el `webServer` del config de la base.
- Corré el flujo, copiá el `.webm` a `flujo.webm` en la evidencia, borrá el config y el spec.
- Si no cambia un flujo, la fila es `no aplica`.

## Cambio crítico

Cambio crítico: todo lo que no sea visual ni CI/CD y pueda tocar base de datos, infraestructura crítica o seguridad.

En este repo entran, entre otros: el Worker, `wrangler.jsonc`, headers, secretos, variables `PUBLIC_*` o `POSTHOG_KEY`, auth, permisos, datos, migraciones y dependencias que cambian la superficie. Un PR mezclado entra por la parte que no es visual.

Docs de reglas y lint no suman el verificador con Codex, salvo que el diff toque secretos, tokens, permisos de workflows, protección de rama, env vars, CI o deploy. En ese caso sí lo suman. El resto de la sección de cambio crítico se corre igual en esos PR.

Si el cambio crítico no aplica, en el informe: «Cambio crítico: no aplica», con una frase de motivo. El resto de esta sección no se corre. Un PR de docs de reglas o de lint no usa esa salida: la sección se corre, y el verificador con Codex entra sólo con la excepción de arriba.

### Superficie, antes de verificar

Escribí `superficie-riesgo.md` antes de correr las puertas de esta sección. Qué toca el diff: tablas, bindings, secretos, rutas, headers, permisos, dependencias. Qué queda afuera. El segundo verificador escribe la suya, `superficie-riesgo-codex.md`, sin ver la primera.

### Segundo verificador

Otra sesión de Codex CLI, con esfuerzo high. El modelo es el que ese CLI tenga configurado.

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

Build limpio, desde la raíz, con sólo `apps/web/.env.example` y `apps/web/.dev.vars.example`:

```bash
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

Wrangler, en un directorio temporal, no en `neutro-web`. No pidas `/f/N` ni `/ingest`. No pegues la key.

```bash
probe="$(mktemp -d "${TMPDIR:-/tmp}/neutro-var-probe.XXXXXX")"
printf '%s\n' 'export default { async fetch(_request, env) { return Response.json({ analyticsEnabled: env.ANALYTICS_ENABLED ?? null, posthogKeyPresent: Boolean(env.POSTHOG_KEY) }); } };' > "$probe/index.js"
printf '%s\n' '{ "name": "var-probe", "main": "index.js", "compatibility_date": "2026-10-01", "vars": { "ANALYTICS_ENABLED": "true" } }' > "$probe/wrangler.jsonc"
printf '%s\n' 'ANALYTICS_ENABLED=from-file' 'POSTHOG_KEY=phc_probe_not_a_real_key' > "$probe/.dev.vars"
```

Desde `$probe`, con el `wrangler` 4.151.2 del repo (`apps/web/node_modules/.bin/wrangler`):

- `--port 8791 --var ANALYTICS_ENABLED:false`. El log dijo `Using secrets defined in .dev.vars`. `curl -sS http://127.0.0.1:8791/` devolvió `{"analyticsEnabled":"false","posthogKeyPresent":true}`.
- El mismo puerto, sin `--var`. El body fue `{"analyticsEnabled":"from-file","posthogKeyPresent":true}`.
- Sin `.dev.vars`, `--port 8792 --var ANALYTICS_ENABLED:false`. El body fue `{"analyticsEnabled":"false","posthogKeyPresent":false}`.

`--var` pisó el flag del archivo y del jsonc. La key del archivo siguió cargada. No está medido en el Worker del repo. Borrá `$probe` al terminar.

## Arreglos

Si el informe propone un arreglo, el arreglo va en otro PR, apilado, dentro del tope de 10 archivos y sin comentarios. Esta corrida no lo commitea, no lo publica y no lo mergea.
