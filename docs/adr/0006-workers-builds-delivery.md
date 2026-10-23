# ADR 0006: Flujo de delivery de `neutro-web` con Workers Builds y Worker Previews

## Status

Propuesto

## Contexto

El Worker `neutro-web` (`apps/web/wrangler.jsonc`) se publica a mano con `wrangler deploy` (`pnpm deploy` desde la raíz). Así, producción llegó a correr un build que no estaba en `main` (#21).

Workers Builds es la integración de Git de Cloudflare con GitHub. En el plan free el presupuesto es:

| Límite           | Plan free                           |
| ---------------- | ----------------------------------- |
| Minutos de build | 3.000 por mes                       |
| Concurrencia     | 1 build a la vez, en toda la cuenta |
| Timeout          | 20 minutos                          |
| Máquina          | 2 vCPU y 8 GB                       |

Un push a la rama de producción buildea y despliega. El resto de las ramas, con los preview builds prendidos, no publica producción: corre un comando de preview y deja la URL en el PR. Cada rama tiene una URL estable (sigue al último build de esa rama) y cada deploy tiene una URL propia de ese commit. La media y el review usan la URL de la rama.

Las Worker Previews no heredan la configuración de producción. Las vars y los secrets van aparte. La URL es pública por defecto. Se puede cerrar con Cloudflare Access (Zero Trust). El plan free de Access llega a 50 usuarios.

El repo ya separa el analytics en dos puertas, y las dos tienen que quedar cerradas fuera de producción:

- Browser, en el build de Astro ([ADR 0001](0001-analytics-off-by-default.md)): hace falta `PUBLIC_POSTHOG_KEY` y `PUBLIC_ANALYTICS_ENABLED` igual a `'true'`. Esas vars quedan fijas en el JavaScript del cliente. No alcanza con apagarlas en runtime.
- Worker, en el redirect QR ([ADR 0002](0002-qr-redirect-routes.md), `isServerAnalyticsEnabled`): hace falta `POSTHOG_KEY` y `ANALYTICS_ENABLED` igual a `"true"`. Sin las dos, el redirect sigue y no se manda `qr_scanned`.

`wrangler.jsonc` hoy tiene `ANALYTICS_ENABLED` en `"true"` al nivel de producción. Este ADR no edita ese archivo. Las previews no heredan ese valor. Wrangler del repo es `4.151.2`, por encima del `4.135.0` que piden las Worker Previews. No hace falta un bump para este flujo.

El tope de 10 archivos por PR ([ADR 0004](0004-max-pr-files.md)) sigue igual. Lo que este ADR cambia es la rama base, no el conteo.

Los comandos que el README ya deja para Workers Builds, con la raíz del repo como directorio de trabajo, Node `24.18.0` y pnpm `12.14.0`:

- Instalación: `pnpm install --frozen-lockfile`.
- Build: `pnpm check && pnpm build`.
- Despliegue de producción: `pnpm --filter @neutro/web deploy` (`wrangler deploy`).

Ese último comando es solo para `main`. En una preview, `wrangler deploy` publicaría producción.

## Opciones consideradas

### A. Solo una rama `staging`

Una sola URL estable, pocos builds, y un lugar fijo para pegarle a `/f/*` y `/t` antes de producción.

No sirve para revisar un PR solo: en `staging` se mezcla todo lo que ya entró. No hay URL por PR para grabar la media de ese cambio. Y el deploy a mano desde cualquier rama sigue pudiendo pisar producción, que es el fallo del #21.

### B. Solo previews por PR

Cada PR tiene su URL, aislada, publicada en el PR. La media sale de ahí.

No queda un ambiente de larga vida para el chequeo final. La URL de la rama deja de ser el integrador apenas se mergea, y el PR siguiente no comparte un host estable para repetir un escaneo. El único paso anterior a producción sería el merge a `main`: el OK de Juan se confunde con el review del feature. Cada URL suma una superficie pública.

### C. Previews por PR y una `staging` de larga vida, antes de `main`

La preview del PR sirve para review y media. `staging` junta lo que ya se aceptó y ofrece una URL estable para el chequeo final. `main` es el único disparador de producción, y solo recibe lo que Juan autoriza.

Cuesta más minutos y más cola: el plan free corre un solo build. Hay que mantener vars de preview distintas de las de producción. `staging` se puede atrasar respecto de `main` si la promoción espera. El apilado de PRs contra la rama del PR anterior deja de ser el camino, aunque el tope de 10 archivos no se mueve.

## Decisión

Se elige **C**.

### Ramas

| Rama        | Rol                                          | Qué corre Workers Builds   |
| ----------- | -------------------------------------------- | -------------------------- |
| Rama del PR | Review y media de ese cambio                 | Preview. No es producción. |
| `staging`   | Integración y chequeo final, con URL estable | Preview. No es producción. |
| `main`      | Producción de `neutro-web`                   | Build y `wrangler deploy`. |

- Los PR de feature apuntan a `staging`.
- `staging` no es la rama de producción del Worker. Un push ahí actualiza su preview y no publica `neutro-web`.
- La promoción es un PR `staging` → `main`. Se mergea solo con el OK explícito de Juan escrito en ese PR (review o comentario). El check de CI no reemplaza ese OK.
- Mergeado a `main`, Workers Builds despliega a producción. No hay un `wrangler deploy` a mano después, ni desde una rama de feature.
- Los QR impresos siguen apuntando al host de producción ([ADR 0002](0002-qr-redirect-routes.md)). El chequeo de `staging` pega a las rutas `/f/*` y `/t` de esa preview. No se reimprime un flyer contra una URL de preview.

### Previews

En toda preview, incluida la de `staging`:

- Analytics apagado. En runtime, `ANALYTICS_ENABLED=false` o ausencia de `POSTHOG_KEY` (con una sola de las dos, `isServerAnalyticsEnabled` no manda el evento). En el build de Astro de cualquier rama que no sea `main`, sin `PUBLIC_POSTHOG_KEY` y sin `PUBLIC_ANALYTICS_ENABLED=true`. No se copia el secret de producción a las previews.
- `X-Robots-Tag: noindex` en la respuesta. En las previews de `workers.dev`, Cloudflare ya manda ese header. Las rutas QR lo mandan desde el Worker. Un hostname propio de preview no lo recibe solo: si más adelante hay dominio de preview, hay que mandarlo nosotros. El criterio no cambia.
- Cloudflare Access queda **opcional**. Si se prende, Max y Andromeda entran por allowlist o por service token (el token, para un cliente que no es un browser). El plan free de Zero Trust cubre hasta 50 usuarios. Access no reemplaza el noindex ni el analytics apagado.

La URL que se comparte, se graba y se le pasa a Atena es la de la rama que el comentario del PR deja estable, no la de un commit viejo, no localhost y no producción.

El comando de preview, con el mismo directorio de trabajo del README, es `pnpm --filter @neutro/web exec wrangler preview`. No es `pnpm deploy` y no es `wrangler deploy`.

## Criterios de media en los pull requests

La media se graba desde la URL de Worker Preview de ese PR, después de que el comentario de Workers Builds la publicó. Apenas esa URL existe, se avisa a Atena con un día de anticipación. No se le pide nada el mismo día en que aparece la preview, ni se avisa antes de que la URL exista.

| Cambio                                                                                                           | Media   | Quién     | Formato                                                            |
| ---------------------------------------------------------------------------------------------------------------- | ------- | --------- | ------------------------------------------------------------------ |
| Flujo, interacción, o algo que se ve distinto en mobile                                                          | Video   | Andromeda | 15–45 s, sin audio, con subtítulos, MP4 1280×720 y un GIF          |
| Cambio visual estático, antes/después de performance (Lighthouse o Core Web Vitals), explicación de arquitectura | Slides  | Max       | PNG 1920×1080, numerados en orden, inline en la descripción del PR |
| Infra, CI, lint, formato, tests, dependencias, redirects                                                         | Ninguna | —         | —                                                                  |

Un PR puede mezclar tipos. La media sigue al tipo que el diff muestra: un redirect no pide video aunque el PR también toque copy. Este ADR es documentación de flujo y no lleva media.

## Consecuencias

- Producción de `neutro-web` cambia cuando un commit entra a `main` por Workers Builds. El deploy a mano deja de ser el camino. El fallo del #21 (producción en un build que no estaba en `main`) no se repite si nadie publica fuera de ese flujo.
- El OK de Juan es la puerta de `staging` a `main`. No es un segundo deploy.
- `staging` puede quedar atrás de `main` mientras la promoción espera ese OK. Los PR nuevos se abren igual contra `staging`.
- El plan free encola. Un push al PR, el merge a `staging` y el deploy de `main` comparten un solo build y los 3.000 minutos del mes. El presupuesto se gasta por push, no por PR mergeado. El build del README (`pnpm check && pnpm build` más el deploy o la preview) tiene que entrar en los 20 minutos.
- El plan free también tiene un tope de 100 previews por Worker. Una rama abandonada ocupa cupo.
- El tope de 10 archivos no se toca. Lo que sí cambia respecto del [ADR 0004](0004-max-pr-files.md): la base esperada pasa a ser `staging`. Partir un cambio en varios PR significa varios PR contra `staging`, no una pila contra la rama del PR anterior.
- Hasta que Juan no conecte el repo, el deploy sigue siendo manual y el riesgo del #21 sigue abierto. Por eso el estado es Propuesto.
- Este documento no agrega el bloque `previews` de Wrangler, no cambia `wrangler.jsonc`, no agrega el check de CI y no crea la rama `staging`.

### Fitness functions

No se implementan en este cambio. Cuando el flujo se adopte, estas son las que tienen que fallar solas:

1. **Base del PR.** En cada `pull_request`, fallar si la base no es `staging`, salvo el PR de promoción: head `staging` y base `main`. Cualquier otro PR contra `main` falla. El check no alcanza para mergear la promoción: sigue haciendo falta el OK de Juan en ese PR.
2. **La preview no manda eventos a PostHog.** Fallar si el ambiente de preview cumple a la vez la puerta del [ADR 0001](0001-analytics-off-by-default.md) (`PUBLIC_ANALYTICS_ENABLED=true` y `PUBLIC_POSTHOG_KEY`) o la del [ADR 0002](0002-qr-redirect-routes.md) (`ANALYTICS_ENABLED=true` y `POSTHOG_KEY`). Un smoke contra la URL de la rama: el HTML no inicializa `posthog-js`, la respuesta trae `X-Robots-Tag: noindex`, y un hit a una ruta QR no sale con analytics prendido.
3. **Producción solo desde `main`.** En el branch control de Workers Builds, `main` es la única rama de producción. `staging` y el resto ejecutan `wrangler preview`. Un build de preview cuyo comando sea `wrangler deploy` no cumple esta función.

## Pasos manuales pendientes

Los hace Juan. Este PR no los ejecuta.

1. En el dashboard de Cloudflare, Worker `neutro-web`, **Settings > Builds**: conectar el repo de GitHub. Rama de producción: `main`. Prender preview builds para lo que no es `main`. Directorio de trabajo: la raíz del repo. Node `24.18.0` y pnpm `12.14.0`. Instalación `pnpm install --frozen-lockfile`, build `pnpm check && pnpm build`, deploy de producción `pnpm --filter @neutro/web deploy`, preview `pnpm --filter @neutro/web exec wrangler preview`.
2. Crear la rama `staging` desde `main`. No marcarla como rama de producción.
3. Configurar las vars de preview, aparte de las de producción: `ANALYTICS_ENABLED=false` o sin `POSTHOG_KEY`, y el build de las ramas que no son `main` sin `PUBLIC_POSTHOG_KEY` ni `PUBLIC_ANALYTICS_ENABLED=true`. No copiar el secret de producción.
4. Opcional: Cloudflare Access sobre las URLs de preview, con allowlist o service token para Max y Andromeda.
