# Informe de verificación

## Identidad

| Campo | Valor |
| --- | --- |
| PR | |
| URL | |
| Título | |
| Rama head | |
| Rama base | |
| Commit head | |
| Commit base | |
| Archivos contados | |
| Lockfiles excluidos | |
| Tipo de cambio | visual / ci-cd / crítico / mixto |
| Carpeta | `evidencia/{{pr}}-{{sha corto}}/` |

### Archivos contados

-

### Lockfiles excluidos

-

## Hallazgos

sin hallazgos

## Puertas

| Puerta | Comando | Exit code | Evidencia |
| --- | --- | --- | --- |
| Preparación | `node -v` y `pnpm --version` | | `00-preparacion.txt` |
| Identidad | `gh pr view` y `git diff --name-only BASE...HEAD` | | `01-identidad.txt` |
| Instalación limpia | `pnpm install --frozen-lockfile` | | `02-install.txt` |
| Lint | `pnpm lint` | | `03-lint.txt` |
| Reglas de lint | `pnpm test:lint-rules` | | `04-lint-rules.txt` |
| Typecheck | `pnpm check` | | `05-check.txt` |
| Tests | `pnpm test` | | `06-test.txt` |
| Build sin analytics | `env -u PUBLIC_POSTHOG_KEY -u PUBLIC_ANALYTICS_ENABLED pnpm build` | | `07-build.txt` |
| Conteo de `posthog` en `dist` | `rg -o -F posthog apps/web/dist` | | `07-build.txt` |
| Requests de analytics | búsqueda en `trace.zip` | | `08-posthog-red.txt` |
| Contrato sobre `dist` | `pnpm --filter @neutro/web test:dist` | | |
| Comentarios en el diff | `git diff -U0 BASE...HEAD` | | `09-comentarios.txt` |
| Tope de 10 archivos | `BASE_SHA=… HEAD_SHA=… node tools/ci/check-pr-file-count.mjs` | | `10-archivos.txt` |
| Cuerpo First Principles | lectura del body | | `11-cuerpo.txt` |
| CI remoto del head | `gh pr view --json statusCheckRollup` | | `12-ci.txt` |
| Falla provocada | copia descartable, una por puerta nueva | | `13-falla-{{puerta}}.txt` |
| Playwright | `pnpm --filter @neutro/web exec playwright test --trace on` | | `14-e2e.txt` |
| Capturas | spec efímero, cuatro por ruta afectada | | |
| Traza | `--trace on` | | `trace.zip` |
| Video de flujo | config efímero con `video: "on"` | | `flujo.webm` |

El exit code es el del comando. Si la fila no aplica, escribí `no aplica` y el motivo en NO VERIFICADO o en esta celda, y no dejes el exit vacío sin motivo.

## VERIFICADO

-

## NO VERIFICADO

-

## Simulado y verificado

| Qué | Clase | Motivo |
| --- | --- | --- |
| | simulado / verificado | |

`astro preview`, `wrangler dev` y los tests locales son simulados. El estado del CI remoto está verificado como estado de GitHub. Producción no se toca.

## Cambio crítico

No aplica.

Motivo:

### Superficie de riesgo

Archivo: `superficie-riesgo.md`. Declarada antes de verificar: sí / no.

### Segundo verificador

Codex CLI, esfuerzo high, sesión aparte, sin este informe.

Archivo: `informe-codex.md`.

### Discrepancias

-

### Pruebas negativas

| Caso | Exit code | Evidencia |
| --- | --- | --- |
| | | |

### Seguridad y dependencias

-

### Migraciones

-

## Qué tiene que decidir Juan

-

Este informe no emite veredicto de merge. El merge a `main` espera el OK explícito de Juan Gallegos.
