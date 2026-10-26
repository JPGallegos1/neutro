# Informe de verificación

## Identidad

| Campo               | Valor                             |
| ------------------- | --------------------------------- |
| PR                  |                                   |
| URL                 |                                   |
| Título              |                                   |
| Rama head           |                                   |
| Rama base           |                                   |
| Commit head         |                                   |
| Commit base         |                                   |
| Archivos contados   |                                   |
| Lockfiles excluidos |                                   |
| Tipo de cambio      | visual / ci-cd / crítico / mixto  |
| Carpeta             | `evidencia/{{pr}}-{{sha corto}}/` |

### Archivos contados

-

### Lockfiles excluidos

-

## Hallazgos

Si no hay hallazgos, dejá sólo esta línea:

sin hallazgos

Si hay hallazgos, reemplazá esa línea por un bloque por hallazgo:

### 1. {severidad} — `archivo:líneas @ {commit corto}`

Qué pasa:

Qué se esperaba:

Evidencia:

La severidad es alta, media o baja. El commit corto son 7 caracteres.

## Puertas

| Puerta                                | Comando                                                                                                        | Exit code     | Evidencia                                |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------- |
| Preparación                           | `node -v` y `pnpm --version`                                                                                   |               | `00-preparacion.txt`                     |
| Nombres de entorno                    | `find -print` de `.env*` y `.dev.vars*`, ruta relativa por línea                                               |               | `00-entorno-nombres.txt`                 |
| Identidad                             | `gh pr view` y `git diff --name-only "$BASE"..."$HEAD"`                                                        |               | `01-identidad.txt`                       |
| Instalación limpia                    | `pnpm install --frozen-lockfile`                                                                               |               | `02-install.txt`                         |
| Lint                                  | `pnpm lint`                                                                                                    |               | `03-lint.txt`                            |
| Reglas de lint                        | `pnpm test:lint-rules`                                                                                         |               | `04-lint-rules.txt`                      |
| Typecheck                             | `pnpm check`                                                                                                   |               | `05-check.txt`                           |
| Tests                                 | `pnpm test`                                                                                                    |               | `06-test.txt`                            |
| Build sin analytics                   | `env -u PUBLIC_POSTHOG_KEY -u PUBLIC_ANALYTICS_ENABLED pnpm exec turbo run build --filter=@neutro/web --force` |               | `07-build.txt`                           |
| Conteo de `posthog` en `dist`         | `rg -o -i -F posthog apps/web/dist`                                                                            |               | `07-build.txt`                           |
| Requests de analytics                 | búsqueda en `trazas/`                                                                                          |               | `08-posthog-red.txt`                     |
| Comentarios en el diff                | `git diff -U0 --no-color "$BASE"..."$HEAD"`                                                                    |               | `09-comentarios.txt`                     |
| Tope de 10 archivos                   | `BASE_SHA=… HEAD_SHA=… node tools/ci/check-pr-file-count.mjs`                                                  |               | `10-archivos.txt`                        |
| Cuerpo First Principles               | lectura del body                                                                                               |               | `11-cuerpo.txt`                          |
| CI remoto del head                    | `gh pr view --json statusCheckRollup`                                                                          |               | `12-ci.txt`                              |
| Falla provocada                       | copia descartable, una por puerta nueva                                                                        |               | `13-falla-{{puerta}}.txt`                |
| Playwright                            | `pnpm --filter @neutro/web exec playwright test --trace on`                                                    |               | `14-e2e.txt`                             |
| Capturas                              | spec efímero, cuatro por ruta afectada                                                                         |               |                                          |
| Traza                                 | `--trace on`, copia a `trazas/<nombre>-<pasada>-trace.zip`                                                     |               | `trazas/<nombre>-<pasada>-trace.zip`     |
| Video de flujo                        | config efímero con `video: "on"`                                                                               |               | `flujo.webm`                             |
| `prefers-reduced-motion`              | captura con `prefers-reduced-motion: reduce`                                                                   |               | `{slug}-reduce-{viewport}.png`           |
| `superficie-riesgo-codex.md`          | superficie que escribe el verificador de Codex                                                                 |               | `superficie-riesgo-codex.md`             |
| PR que sólo cambia CI                 | no suma el verificador de Codex                                                                                | no aplica     | «un PR que sólo cambia CI no suma Codex» |
| e2e sin JavaScript en `/trabajo`      | `apps/web/e2e/trabajo-sin-js.spec.ts`                                                                          | NO VERIFICADO | «spec de Hamilton ausente»               |
| e2e teclado y aria-live en Cargar más | `apps/web/e2e/trabajo-cargar-mas.spec.ts`                                                                      | NO VERIFICADO | «spec de Hamilton ausente»               |
| axe, claro y oscuro                   | `apps/web/e2e/a11y.spec.ts`                                                                                    | NO VERIFICADO | «spec de Hamilton ausente»               |
| analytics apagado                     | `apps/web/e2e/analytics-apagado.spec.ts`                                                                       | NO VERIFICADO | «spec de Hamilton ausente»               |
| Contrato sobre `dist`                 | `pnpm --filter @neutro/web test:dist`                                                                          | NO VERIFICADO | «spec de Hamilton ausente»               |

El exit code es el del comando. Si la fila no aplica, escribí `no aplica` y el motivo, y no dejes el exit vacío sin motivo. Las cinco filas de Hamilton quedan en NO VERIFICADO con motivo «spec de Hamilton ausente» mientras ese archivo no esté en el repo. Cuando esté, reemplazá esa celda por el exit real.

En la evidencia, hosts de analytics, URLs de producción con parámetros y cualquier key se reemplazan por `‹redactado›`. Los links públicos del sitio, sin parámetros, se dejan.

## VERIFICADO

Un bloque por ítem. Si no hay ítems, dejá sólo esta línea: ninguno

### {ítem}

Comando ejecutado:

Salida literal o recorte:

Exit code:

## NO VERIFICADO

Un bloque por ítem. Si no hay ítems, dejá sólo esta línea: ninguno

### {ítem}

Comando ejecutado:

Salida literal o recorte:

Exit code:

Qué faltó:

Por qué:

## Simulado y verificado

| Qué | Clase                 | Motivo |
| --- | --------------------- | ------ |
|     | simulado / verificado |        |

`astro preview`, `wrangler dev` y los tests locales son simulados. El estado del CI remoto está verificado como estado de GitHub. Producción no se toca.

## Cambio crítico

No aplica.

Motivo:

### Superficie de riesgo

Archivo: `superficie-riesgo.md`. Declarada antes de verificar: sí / no.

### Segundo verificador

Un PR que sólo cambia CI no suma Codex. En ese caso esta subsección queda en `no aplica` y no se escribe `informe-codex.md`.

Codex CLI, esfuerzo high, sesión aparte, sin este informe, cuando el cambio es crítico según la regla de arriba.

Archivo: `informe-codex.md`.

Superficie de esa sesión: `superficie-riesgo-codex.md`. Es la evidencia del verificador de Codex. La escribe sin ver `superficie-riesgo.md`.

### Discrepancias

-

### Pruebas negativas

| Caso             | Exit code | Evidencia |
| ---------------- | --------- | --------- |
| Entrada inválida |           |           |
| Sin permiso      |           |           |
| Sin la variable  |           |           |

### Seguridad y dependencias

-

### Migraciones

-

## Qué tiene que decidir Juan

-

Este informe no emite veredicto de merge. El merge a `main` espera el OK explícito de Juan Gallegos.
