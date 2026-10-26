# Neutro

Monorepositorio con pnpm y Turborepo. La aplicación pública es una landing estática en Astro (español rioplatense): home con Hero, video, sección Trabajo y Servicios; página Nosotros; páginas legales (`/cookies`, `/privacidad`, `/terminos`, `/alerta-estafa`); y un Worker de Cloudflare para redirects QR, proxy first-party de PostHog en `/ingest` y URLs sin barra final.

Para reglas de contribución pensadas para agentes, consultá [`AGENTS.md`](AGENTS.md).

## Requisitos

- Node.js **24.18.0**, fijado en `.node-version`.
- pnpm **12.14.0**, fijado en `packageManager`.

Con Corepack disponible, habilitá primero los ejecutables de pnpm:

```sh
corepack enable pnpm
```

Después instalá y arrancá el proyecto:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Si ya tenés `pnpm` en el PATH, podés omitir `corepack`. Turborepo necesita ese ejecutable para ejecutar las tareas del workspace. En Windows PowerShell con scripts deshabilitados usá `corepack.cmd pnpm …`. Si Node está instalado en una carpeta protegida, podés habilitar pnpm sin permisos de administrador con `corepack.cmd enable pnpm --install-directory "$env:APPDATA\npm"`, siempre que esa carpeta exista y esté en el PATH.

La web se sirve en `http://localhost:4321`.

## Estructura

```text
apps/
  web/                  # Astro + React + Vite; única aplicación desplegable
    public/             # Favicon, robots, video e imágenes
    src/
      components/       # Logo, ThemeToggle y secciones de la landing
      data/             # Nav, trabajo, servicios, sociales y page-meta
      layouts/          # Documento HTML (base) y layout legal
      lib/              # Sitio y analytics del navegador (vars de build)
      pages/            # Home, nosotros, legales y 404
      scripts/          # Controles de tema
      styles/           # Estilos de la landing
    worker/             # Worker: QR, /ingest y slashless
    astro.config.mjs
    components.json     # shadcn/ui enlazado al paquete compartido
    wrangler.jsonc      # Worker neutro-web + Static Assets
packages/
  core/                 # Esquemas, QR redirects y lógica TypeScript con Effect
  ui/                   # shadcn/ui, utilidades y tema Tailwind compartidos
  typescript-config/    # Configuración estricta compartida
docs/
  adr/                  # Decisiones de arquitectura
  seo/                  # Criterios SEO (p. ej. superficie Trabajo)
  dependencies.md       # Versiones verificadas y decisiones de compatibilidad
  conectar-dominio.md   # Guía para conectar neutro.solutions
tools/
  ci/                   # Check de tamaño de PR
  oxlint/               # Regla neutro/no-comments
```

Los paquetes internos exportan código fuente TypeScript y usan `workspace:*`. Vite compila ese código al construir la aplicación. Turborepo coordina las verificaciones y cachea el build. Las nuevas aplicaciones van en `apps/*`; las librerías compartidas, en `packages/*`.

En la home, la sección Trabajo vive en `/#trabajo` (grilla de casos). El índice `/trabajo` y las fichas `/trabajo/<slug>` están documentados en [`docs/seo/trabajo.md`](docs/seo/trabajo.md) y el [ADR 0005](docs/adr/0005-trabajo-routing-and-seo.md); todavía no hay páginas Astro para esas rutas en `main`.

## Comandos

Ejecutar desde la raíz con `pnpm` o `corepack pnpm`:

| Comando                    | Función                                           |
| -------------------------- | ------------------------------------------------- |
| `pnpm dev`                 | Desarrollo de la aplicación pública               |
| `pnpm check`               | Tipos de los paquetes y diagnóstico de Astro      |
| `pnpm build`               | Build de la web en `apps/web/dist`                |
| `pnpm preview`             | Servir el último build con Astro                  |
| `pnpm format`              | Formatear código, Astro y clases Tailwind         |
| `pnpm format:check`        | Verificar formato                                 |
| `pnpm ui:add <componente>` | Agregar componentes shadcn/ui al monorepositorio  |
| `pnpm deploy:check`        | Build y validación local de Wrangler sin publicar |
| `pnpm preview:cloudflare`  | Build y servidor local de Cloudflare              |
| `pnpm deploy`              | Verificar, construir y publicar solo la web       |

## UI y estilos

Tailwind CSS 4 se integra como plugin de Vite en `apps/web/astro.config.mjs`. El tema y los tokens de shadcn/ui se encuentran en `packages/ui/src/styles/globals.css` (mapeados a la paleta Neutro, con clase `.dark` en `<html>`). El layout de Astro importa ese CSS global y autoaloja Geist Sans (400/500/700) y Geist Mono. Las fuentes de Tailwind incluyen tanto la aplicación como los componentes compartidos.

En producción el analytics del navegador está activo desde el deploy del 24/10/2026. Se prende en el build de Astro con `PUBLIC_POSTHOG_KEY` y `PUBLIC_ANALYTICS_ENABLED=true`: sin las dos, `apps/web/src/lib/analytics.ts` no descarga `posthog-js` (import dinámico) y el SDK no corre. La otra puerta es el Worker: manda `qr_scanned` server-side con `POSTHOG_KEY` y `ANALYTICS_ENABLED="true"` en `wrangler.jsonc`. Previews y `staging` quedan con analytics apagado ([ADR 0006](docs/adr/0006-workers-builds-delivery.md), estado Propuesto). Ver [`docs/adr/0001-analytics-off-by-default.md`](docs/adr/0001-analytics-off-by-default.md).

shadcn/ui está configurado con estilo `new-york`, base `neutral`, React y `lucide-react` para íconos. `Button` queda incluido como componente inicial. Los componentes son código del proyecto, no un runtime de shadcn.

```sh
corepack pnpm ui:add card
```

Ejemplo de isla React:

```tsx
import { Button } from "@neutro/ui/components/button";
import { ArrowRight } from "lucide-react";

export function CallToAction() {
  return (
    <Button>
      Continuar <ArrowRight aria-hidden="true" />
    </Button>
  );
}
```

Astro renderiza React como HTML por defecto. Usá `client:load` o `client:visible` al importar una isla React que necesite interacción. La landing actual es HTML/CSS con scripts Astro para tema, menú móvil, video y acordeón de servicios.

## TypeScript y Effect

La configuración compartida activa modo estricto, validación de índices y propiedades opcionales exactas. `packages/core/src/site.ts` define el esquema de metadatos con Effect Schema y expone un decoder con errores tipados. `apps/web/src/lib/site.ts` ejecuta ese efecto en el límite del build de Astro: los metadatos inválidos detienen la construcción.

Effect complementa a TypeScript con validación en ejecución y modelado de efectos y errores; el chequeo estático lo hace TypeScript. No hace falta cargar Effect en el navegador para esta página.

## Cloudflare

La web se publica como Worker `neutro-web` con Static Assets. Astro genera un sitio estático; el entry `apps/web/worker/index.ts` corre primero (`run_worker_first`): redirects QR (`/f/*`, `/t`), proxy PostHog en `/ingest` y redirección 301 de trailing slash a URL sin barra. Wrangler sirve `dist` y usa `404.html` para rutas inexistentes. Ver [`docs/adr/0002-qr-redirect-routes.md`](docs/adr/0002-qr-redirect-routes.md).

Para login y deploy:

```sh
corepack pnpm --filter @neutro/web exec wrangler login
corepack pnpm deploy
```

Para Workers Builds, usar la raíz del repositorio como directorio de trabajo:

- Instalación: `pnpm install --frozen-lockfile`.
- Build: `pnpm check && pnpm build`.
- Despliegue: `pnpm --filter @neutro/web deploy`.
- Versión de Node: `24.18.0`; versión de pnpm: `12.14.0`.

El dominio y la cuenta se detallan en [`docs/conectar-dominio.md`](docs/conectar-dominio.md). Si más adelante hacen falta rutas SSR o bindings, se agregará `@astrojs/cloudflare` y se generarán sus tipos con `wrangler types`.

## Dependencias

Las versiones directas están fijadas y el lockfile conserva las transitivas para instalaciones reproducibles. Consultá la revisión inicial en [`docs/dependencies.md`](docs/dependencies.md).

Para revisar actualizaciones sin instalarlas:

```sh
corepack pnpm outdated -r
```
