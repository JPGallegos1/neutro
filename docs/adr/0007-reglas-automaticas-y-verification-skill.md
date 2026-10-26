# ADR 0007: Reglas automáticas y verification skill

## Status

Propuesto

## Contexto

Varios criterios de revisión del sitio estaban sólo en [`AGENTS.md`](../../AGENTS.md) y en los ADR. Parte ya corre sola. Parte sigue en la persona que lee el PR. Lucy necesita un informe con evidencia, igual para cada PR, antes de que Juan mire el merge.

Lo que ya está en el repo, y esta decisión no vuelve a implementar:

- Tope de 10 archivos: job `Max 10 files`, `tools/ci/check-pr-file-count.mjs` ([ADR 0004](0004-max-pr-files.md)).
- Sin comentarios en JS, TS y en el frontmatter y los `<script>` de Astro: `pnpm lint` y `pnpm test:lint-rules` ([ADR 0003](0003-no-source-comments.md)). Ese ADR limita el alcance a eso. El HTML de plantilla y el CSS quedan afuera de oxlint, y no afirma que los haga cumplir. No habla de YAML ni de un campo `razon`.
- CI de `Lint` y `Check`. En la base de Playwright, `Check` corre `pnpm check` y `pnpm --filter @neutro/web test`. No corre `pnpm test` de la raíz ni un job de build propio. El workflow `e2e` sí construye, sin `PUBLIC_POSTHOG_KEY` ni `PUBLIC_ANALYTICS_ENABLED`, y corre Chromium.
- Analytics apagado salvo las dos variables de build ([ADR 0001](0001-analytics-off-by-default.md)). El Worker hace `/f/N`, `/t`, `/ingest` y el redirect de barra final ([ADR 0002](0002-qr-redirect-routes.md)). `astro preview` no ejecuta ese Worker.

`main` no tiene protección de rama. Juan decidió el 26/10 que no se active: GitHub no aplica reglas de protección en repos privados con plan gratuito. Los checks siguen corriendo como aviso. Nadie mergea con CI rojo, y nadie mergea a `main` sin el OK explícito de Juan. El bloqueo es de proceso, no de la plataforma.

Playwright es la prueba del sitio construido. Juan aceptó la dependencia y la descarga del browser en CI. La base (config, Chromium, humo, workflow con un job, caché y filtro de paths) entra en el PR de esa base. Los specs de producto y axe son de Hamilton y entran después.

La verification skill se adelanta porque Lucy la necesita para revisar. El número 0007 es el siguiente libre respecto de [0006](0006-workers-builds-delivery.md). Otra rama paralela puede haber usado el mismo número: si pasa, se renumera antes de integrar.

Este ADR no edita workflows, no crea `staging` y no prende checks requeridos.

## Decisión

Cada regla tiene un mecanismo y un dueño. La skill no reemplaza al mecanismo: lo corre, guarda la salida y marca lo que no pudo ver.

| Regla                                        | Mecanismo                                                                                                           | Dueño                                           | Qué hace la skill                                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Máximo 10 archivos, lockfiles afuera         | CI, job `Max 10 files`                                                                                              | Ya está. [ADR 0004](0004-max-pr-files.md)       | Vuelve a correr el mismo script con los SHA del PR                                                               |
| Sin comentarios en el fuente                 | `pnpm lint` y `pnpm test:lint-rules`                                                                                | Ya está. [ADR 0003](0003-no-source-comments.md) | Recorre además las líneas agregadas que ese ADR no cubre                                                         |
| Cards de Trabajo sin JavaScript              | Playwright, spec fijo                                                                                               | Hamilton, PR posterior                          | Lo corre cuando el archivo está                                                                                  |
| Botón, foco y `aria-live`                    | Playwright, spec fijo                                                                                               | Hamilton, PR posterior                          | Lo corre cuando el archivo está                                                                                  |
| Sitemap, canonical, title y description      | Contrato sobre `dist`                                                                                               | Hamilton, PR posterior                          | Corre `test:dist` sólo si el script existe                                                                       |
| Links externos con `noopener` y `noreferrer` | Contrato sobre `dist`                                                                                               | Hamilton, PR posterior                          | Entra por el mismo script, cuando exista                                                                         |
| Cuerpo del PR en First Principles            | La skill, ahora. Un check de CI queda para un PR posterior                                                          | Skill                                           | Exige los seis `##`, en orden, con texto                                                                         |
| Lint, typecheck, tests y build               | La skill corre `pnpm lint`, `pnpm test:lint-rules`, `pnpm check`, `pnpm test` y `pnpm build`                        | Skill, más ancha que el CI de esta base         | El verde remoto no sustituye el `pnpm test` de la raíz                                                           |
| Contraste y axe, claro y oscuro              | `@axe-core/playwright` en el mismo Playwright                                                                       | Hamilton, PR posterior                          | Corre el spec y adjunta la salida. No lo escribe                                                                 |
| 4 cards en la home y todas en `/trabajo`     | Contrato sobre el HTML construido, contra [ADR 0005](0005-trabajo-routing-and-seo.md)                               | Hamilton, PR posterior                          | No lo duplica en esta skill                                                                                      |
| Analytics apagado en la corrida              | Build sin las dos variables públicas, conteo de `posthog` en `dist`, cero requests a `/ingest` y a hosts de PostHog | Skill. El spec fijo es posterior                | El conteo se anota y se clasifica (texto legal, chunk JS u otro). Texto legal y un chunk sin key no fallan solos |
| Cambio crítico                               | Segundo verificador, superficie, negativas, seguridad, migraciones, simulado contra verificado, lista para Juan     | Lucy lo lanza. La skill fija el procedimiento   | Sin veredicto de merge                                                                                           |

Cambio crítico: todo lo que no sea visual ni CI/CD y pueda tocar base de datos, infraestructura crítica o seguridad.

Docs de reglas y lint no suman el verificador con Codex, salvo que el diff toque secretos, tokens, permisos de workflows, protección de rama, env vars, CI o deploy. En ese caso sí lo suman. El resto de la sección de cambio crítico se corre igual en esos PR.

Esta regla de exclusión está propuesta y espera el OK de Juan Gallegos.

### Playwright

Es la base para probar el sitio construido. El comando de la skill es `pnpm --filter @neutro/web exec playwright test --trace on`. El script `test:e2e` es `playwright test`. `--trace on` hace que un verde también deje un `trace.zip` por test. Playwright vacía `test-results/` al arrancar otra corrida. La skill copia cada traza a `evidencia/<pr>-<sha>/trazas/<nombre>-trace.zip` antes de la pasada de capturas, para que no se pierdan ni se pisen.

El workflow de la base ya acota el costo: un job, un browser (Chromium), caché del browser, y corre cuando cambia `apps/web`, `packages`, el lockfile o el propio workflow. Esta decisión no le cambia el YAML.

En un PR visual la skill agrega capturas por ruta afectada (claro y oscuro, móvil y escritorio) y el `trace.zip`. Si cambia un flujo completo, también el video `.webm`. Esas capturas no reemplazan los specs de Hamilton.

`astro preview`, que es el servidor de Playwright, no ejecuta el Worker y responde 404 en `/nosotros/` con barra. `/f/N`, `/ingest` y los redirects se ven con el Worker local, sólo cuando el diff los toca, y sin mandar eventos a PostHog.

### La skill

Vive en [`.cursor/skills/verify-web/SKILL.md`](../../.cursor/skills/verify-web/SKILL.md). La plantilla del informe está al lado, `plantilla-informe.md`.

Produce un informe por PR en `evidencia/<pr>-<sha corto>/`. El verificador no comenta, no publica y no mergea. No emite veredicto de merge. Le deja el informe a Lucy.

En un cambio crítico, Lucy suma un segundo verificador: Codex CLI con esfuerzo high, en otra sesión, con el diff y el mismo checklist, sin el informe del primero. El modelo es el que el CLI tenga configurado. Toda discrepancia entre los dos informes queda como hallazgo abierto. El informe termina con lo que Juan tiene que decidir.

### Protección de rama

No se activa.

GitHub no aplica reglas de protección en repos privados con plan gratuito. Marcar `Lint`, `Check`, `Max 10 files` o `Chromium` como checks requeridos no bloquearía el merge en este repo, y daría por cerrado un candado que la plataforma no pone.

Los checks siguen como aviso. El bloqueo es de proceso: no se mergea con CI rojo, y no se mergea a `main` sin el OK explícito de Juan Gallegos. Si el plan de GitHub cambia, la protección se vuelve a mirar. Este ADR no la prende.

## Alternativas

### A. Activar la protección de `main` y los checks requeridos

Deja el bloqueo en la plataforma, que es lo que el orden de PR anterior pedía.

No sirve con el plan actual: la regla no se aplica en un repo privado gratuito. Quedaría una configuración que no impide el merge. Por eso Juan la descartó el 26/10. El proceso ocupa ese lugar, con el límite de que alguien con permiso de escritura puede igual apretar merge.

### B. Sólo CI, sin skill

Los checks que ya existen avisan solos y no dependen de que alguien siga una skill.

No le alcanza a Lucy. El CI de esta base no arma el informe, no guarda capturas ni traza para el PR visual, no recorre los comentarios que oxlint no ve, no lee el cuerpo del PR y no tiene modo de cambio crítico ni segundo verificador. La skill cubre eso sin mover workflows en este cambio.

### C. La skill escribe los specs de axe, sin JavaScript y de contrato

Un solo lugar tendría la regla y la prueba.

Hamilton es dueño de esos specs y de las reglas fijas. Si la skill también los define, hay dos fuentes de verdad el día que el spec entre. La skill los corre y adjunta. Si el archivo no está, el informe dice NO VERIFICADO y el motivo, y no inventa un checklist paralelo.

### D. Fijar el id de modelo del segundo verificador

El informe del cambio crítico saldría siempre del mismo modelo.

El CLI cambia de modelo. Un id escrito en la skill queda viejo y parece una puerta. La puerta es Codex CLI con esfuerzo high, en una sesión que no ve el primer informe.

## Consecuencias y trade-offs

- La protección de rama sigue apagada. Un check rojo no impide el merge en GitHub. El proceso es el único bloqueo, y depende de que quien mergea lo respete. El OK de Juan tampoco lo pone la plataforma.
- Playwright en un repo privado consume minutos de GitHub Actions. El plan de Actions no está verificado en este ADR. Cada corrida de `e2e` descarga o reusa Chromium y ocupa un runner cuando el diff entra en el filtro de paths. La mitigación ya está en el workflow de la base: un job, un browser, caché y paths. Baja el consumo y no lo elimina. Este ADR no lo mide.
- La skill pide `pnpm test` y `pnpm build` aunque el job `Check` de esta base no haga las dos cosas. Un CI verde y una puerta local en rojo pueden convivir. Eso es un hallazgo del informe, no un cambio de YAML en este PR.
- El conteo de la cadena `posthog` en `dist` puede ser mayor que cero con el SDK apagado. La búsqueda es `rg -i` porque el texto legal escribe `PostHog`. El informe lista cada archivo de esa corrida y lo clasifica: texto legal, chunk JS u otro. Un archivo JS con la key, o una request de analytics, es hallazgo alto. El conteo solo no falla la puerta. Las cifras, la receta y las versiones están en la skill, como medición de la VM del agente el 2026-10-26. No son un piso de cada PR.
- Esa medición también vio que un `.env*` real en `apps/web` vuelve a meter una key de prueba en el cliente aunque el proceso la saque con `env -u`, y que `--var` en un Worker de prueba pisa el flag y deja cargada la key de `.dev.vars`. La skill no admite esos archivos en la pasada. No está medido en `neutro-web`, ni si una variable que ya está en el proceso le gana al archivo.
- `evidencia/` está en `.gitignore`. Igual se agregan archivos por nombre.
- El segundo verificador sigue la regla de exclusión de arriba. Pide otra sesión de Codex CLI. Sin el CLI, el informe deja esa parte en NO VERIFICADO y no simula el pase. El resto de la sección de cambio crítico se corre igual en un PR de docs de reglas o de lint.
- El informe no autoriza el merge. Puede quedar todo en verde y el PR sigue esperando el OK de Juan.
- Los contratos de SEO, links, cards, axe y el check de CI del cuerpo siguen afuera. Cuando Hamilton los sume, la skill los corre sin cambiar de forma: el comando ya está en la plantilla.
- [ADR 0006](0006-workers-builds-delivery.md) sigue Propuesto. `staging` no existe. La base de un PR, para el conteo, es la que el PR declara.
- Este documento no toca `.github/workflows/`, no corre `pnpm deploy` y no prende analytics.
