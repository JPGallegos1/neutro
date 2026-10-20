# Revisión inicial de dependencias

Fecha: **19 de octubre de 2026**. Se consultó el registro npm antes de instalar, incluyendo `version`, `engines` y `peerDependencies`; también se revisaron las guías oficiales de Astro, shadcn/ui, pnpm, Turborepo y Cloudflare.

Se seleccionaron las versiones estables publicadas bajo `latest`, con las excepciones de compatibilidad descritas al final. Las dependencias directas usan versiones exactas y las internas `workspace:*`.

| Dependencia                         | Versión seleccionada |
| ----------------------------------- | -------------------- |
| Astro                               | 7.4.1                |
| `@astrojs/react`                    | 7.1.0                |
| Vite                                | 8.3.4                |
| React / React DOM                   | 19.3.1               |
| Tailwind CSS / `@tailwindcss/vite`  | 4.3.3                |
| shadcn CLI                          | 4.22.1               |
| `lucide-react`                      | 1.59.0               |
| Effect                              | 4.0.5                |
| Turborepo                           | 2.11.9               |
| pnpm                                | 12.14.0              |
| TypeScript                          | 6.0.3                |
| `@astrojs/check`                    | 0.9.11               |
| `@types/react` / `@types/react-dom` | 19.3.0               |
| `@types/node`                       | 24.19.2              |
| Wrangler                            | 4.151.2              |
| `class-variance-authority`          | 0.7.1                |
| `clsx`                              | 2.1.1                |
| `tailwind-merge`                    | 3.7.0                |
| `radix-ui`                          | 1.8.1                |
| `tw-animate-css`                    | 1.4.0                |
| `@fontsource/geist-sans`            | 5.3.0                |
| `@fontsource/geist-mono`            | 5.3.0                |
| `posthog-js`                        | 1.438.12             |
| Prettier                            | 3.9.10               |
| `prettier-plugin-astro`             | 1.1.1                |
| `prettier-plugin-tailwindcss`       | 0.8.1                |

## Compatibilidad

- **TypeScript:** `latest` es 7.0.2, pero `@astrojs/check@0.9.11` declara `^5.0.0 || ^6.0.0`. Se eligió **6.0.3**, la última de la rama compatible, sin forzar peers ni ocultar el conflicto.
- **Tipos de Node:** `latest` es 26.6.5. Se eligió **24.19.2**, la última versión de la rama 24, para mantener los tipos alineados con Node 24 usado por el proyecto.
- **Node:** Astro requiere `>=22.22.0`. El entorno ya dispone de **24.18.0** y se fijó esa versión para desarrollo y despliegue.
- Astro y la integración de React utilizan Vite `^8.3.4`; `@tailwindcss/vite` declara soporte para Vite 8.
- React 19.3.1 está dentro de los rangos soportados por Astro React, Radix y Lucide.
- `oxc-transform-react` es un peer opcional para el compilador React experimental y no es necesario para la integración estándar.
- No se instala `@astrojs/cloudflare`: la web actual está completamente prerenderizada y Workers Static Assets publica directamente `dist`.
- Wrangler tiene `@cloudflare/workers-types` como peer opcional. Esta web no tiene código Worker ni bindings; si se añaden, se generarán los tipos desde Wrangler.
- `posthog-js` arrastra `core-js`, cuyo `postinstall` sólo muestra un mensaje de funding. Se deja **sin** scripts de build (`allowBuilds.core-js: false`).
- Las fuentes Geist se autoalojan con `@fontsource/geist-sans` y `@fontsource/geist-mono` 5.3.0. `posthog-js` 1.438.12 queda instalado pero no se inicializa salvo flags de entorno.
- `strictPeerDependencies: true` hace que pnpm rechace conflictos de peers. Los scripts de instalación de binarios se limitan explícitamente a los paquetes necesarios en `pnpm-workspace.yaml`.

## Resultado de la auditoría

`pnpm outdated -r` sólo reporta las dos excepciones anteriores: TypeScript 7 y los tipos de Node 26. El resto de las dependencias directas coincide con `latest`.

`pnpm audit --audit-level=high` detecta **una vulnerabilidad alta** en `braces <=3.0.3`, sin versión corregida publicada: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Llega a través de `shadcn → fast-glob → micromatch → braces` y otras rutas transitivas del mismo CLI. Un patrón de llaves excesivamente anidado puede agotar la pila del proceso Node.

shadcn es una dependencia de desarrollo usada al añadir componentes. `braces` no se incluye en el HTML/CSS de la página pública ni se ejecuta en Cloudflare con este despliegue estático. Se conserva la última versión del CLI y se registra el hallazgo sin silenciarlo ni forzar una sustitución incompatible; la auditoría seguirá reportándolo hasta que el proveedor publique una corrección.

pnpm añadió a `minimumReleaseAgeExclude` las versiones exactas recién publicadas que resolvió durante esta instalación, conservando su política de antigüedad para futuras actualizaciones.

## Referencias

- [Astro + React](https://docs.astro.build/en/guides/integrations-guide/react/)
- [shadcn/ui + Astro](https://ui.shadcn.com/docs/installation/astro)
- [shadcn/ui en monorepositorios](https://ui.shadcn.com/docs/monorepo)
- [Estructura de Turborepo](https://turborepo.com/docs/crafting-your-repository/structuring-a-repository)
- [Configuración de pnpm](https://pnpm.io/settings)
- [Astro en Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/)
- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
