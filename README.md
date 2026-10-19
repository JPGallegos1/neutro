# Neutro

Monorepositorio con pnpm y Turborepo. Por ahora la única aplicación es la web pública: una página estática **Under construction** en Astro.

## Requisitos

- Node.js **24.18.0**, fijado en `.node-version`.
- pnpm **12.14.0**, fijado en `packageManager`.

Con Corepack disponible, habilita primero los ejecutables de pnpm:

```sh
corepack enable pnpm
```

Después instala y arranca el proyecto:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Si ya tienes `pnpm` en el PATH, puedes omitir `corepack`. Turborepo necesita ese ejecutable para ejecutar las tareas del workspace. En Windows PowerShell con scripts deshabilitados utiliza `corepack.cmd pnpm …`. Si Node está instalado en una carpeta protegida, puedes habilitar pnpm sin permisos de administrador con `corepack.cmd enable pnpm --install-directory "$env:APPDATA\npm"`, siempre que esa carpeta exista y esté en el PATH.

La web se sirve en `http://localhost:4321`.

## Estructura

```text
apps/
  web/                  # Astro + React + Vite; única aplicación desplegable
    public/             # Archivos estáticos
    src/
      layouts/          # Documento HTML y metadatos
      lib/              # Configuración y lógica de la aplicación
      pages/            # Inicio y página 404
    astro.config.mjs
    components.json     # shadcn/ui enlazado al paquete compartido
    wrangler.jsonc      # Configuración futura de Cloudflare
packages/
  core/                 # Esquemas y lógica TypeScript con Effect
  ui/                   # shadcn/ui, utilidades y tema Tailwind compartidos
  typescript-config/    # Configuración estricta compartida
docs/
  dependencies.md       # Versiones verificadas y decisiones de compatibilidad
```

Los paquetes internos exportan código fuente TypeScript y usan `workspace:*`. Vite compila ese código al construir la aplicación. Turborepo coordina las verificaciones y cachea el build. Las nuevas aplicaciones van en `apps/*`; las librerías compartidas, en `packages/*`.

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
| `pnpm ui:add <componente>` | Añadir componentes shadcn/ui al monorepositorio   |
| `pnpm deploy:check`        | Build y validación local de Wrangler sin publicar |
| `pnpm preview:cloudflare`  | Build y servidor local de Cloudflare              |
| `pnpm deploy`              | Verificar, construir y publicar sólo la web       |

## UI y estilos

Tailwind CSS 4 se integra como plugin de Vite en `apps/web/astro.config.mjs`. El tema y los tokens de shadcn/ui se encuentran en `packages/ui/src/styles/globals.css`; el layout de Astro importa ese CSS global. Las fuentes de Tailwind incluyen tanto la aplicación como los componentes compartidos.

shadcn/ui está configurado con estilo `new-york`, base `neutral`, React y `lucide-react` para íconos. `Button` queda incluido como componente inicial. Los componentes son código del proyecto, no un runtime de shadcn.

```sh
corepack pnpm ui:add card
```

Ejemplo para una futura sección React:

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

Astro renderiza React como HTML por defecto. Usa `client:load` o `client:visible` al importar una isla React que necesite interacción. La página actual sólo genera HTML y CSS.

## TypeScript y Effect

La configuración compartida activa modo estricto, validación de índices y propiedades opcionales exactas. `packages/core/src/site.ts` define el esquema de metadatos con Effect Schema y expone un decoder con errores tipados. `apps/web/src/lib/site.ts` ejecuta ese efecto en el límite del build de Astro: los metadatos inválidos detienen la construcción.

Effect complementa a TypeScript con validación en ejecución y modelado de efectos y errores; el chequeo estático lo hace TypeScript. No hace falta cargar Effect en el navegador para esta página.

## Cloudflare: siguiente etapa

La configuración está preparada para **Workers Static Assets** con el nombre `neutro-web`. Astro genera un sitio estático, por lo que no necesita un adaptador SSR ni un script Worker. Wrangler sirve `dist` y utiliza `404.html` para rutas inexistentes.

Cuando se conecte Cloudflare:

```sh
corepack pnpm --filter @neutro/web exec wrangler login
corepack pnpm deploy
```

Para Workers Builds, usar la raíz del repositorio como directorio de trabajo:

- Instalación: `pnpm install --frozen-lockfile`.
- Build: `pnpm check && pnpm build`.
- Despliegue: `pnpm --filter @neutro/web deploy`.
- Versión de Node: `24.18.0`; versión de pnpm: `12.14.0`.

El dominio real y la cuenta se configurarán al conectar Cloudflare. Si más adelante hacen falta rutas SSR o bindings, se añadirá `@astrojs/cloudflare` y se generarán sus tipos con `wrangler types`.

## Dependencias

Las versiones directas están fijadas y el lockfile conserva las transitivas para instalaciones reproducibles. Consulta la revisión inicial en [`docs/dependencies.md`](docs/dependencies.md).

Para revisar actualizaciones sin instalarlas:

```sh
corepack pnpm outdated -r
```
