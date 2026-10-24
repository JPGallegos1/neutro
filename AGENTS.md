# AGENTS.md

Reglas de contribución para agentes y autores. Una idea por ítem. Arranque del repo: [`README.md`](README.md). Decisiones y contexto: [`docs/`](docs/).

Versión de Node: ver [`.node-version`](.node-version). Versión de pnpm: campo `packageManager` de [`package.json`](package.json).

## Qué es el repo

- Monorepo pnpm + Turborepo; app pública en `apps/web` (Astro estático, español rioplatense).
- Paquetes compartidos en `packages/` (`core`, `ui`, `typescript-config`).
- ADR en [`docs/adr/`](docs/adr/); criterios SEO en [`docs/seo/`](docs/seo/); dependencias en [`docs/dependencies.md`](docs/dependencies.md).

## Reglas del repo

- Máximo **10 archivos** por PR (lockfiles fuera del conteo). Detalle: [`docs/adr/0004-max-pr-files.md`](docs/adr/0004-max-pr-files.md). CI: job Max 10 files.
- **Sin comentarios** en el código fuente (JS/TS y frontmatter/script de Astro). Regla oxlint `neutro/no-comments`. Excepciones mínimas de tooling (`@ts-expect-error`, `oxlint-*`, `prettier-ignore`, etc.). Detalle: [`docs/adr/0003-no-source-comments.md`](docs/adr/0003-no-source-comments.md).
- Analytics off por defecto: [`docs/adr/0001-analytics-off-by-default.md`](docs/adr/0001-analytics-off-by-default.md).
- Redirects QR y Worker: [`docs/adr/0002-qr-redirect-routes.md`](docs/adr/0002-qr-redirect-routes.md).
- Routing/SEO de Trabajo (docs; implementación sujeta a OK de diseño): [`docs/adr/0005-trabajo-routing-and-seo.md`](docs/adr/0005-trabajo-routing-and-seo.md) y [`docs/seo/trabajo.md`](docs/seo/trabajo.md).
- Delivery con Workers Builds: [`docs/adr/0006-workers-builds-delivery.md`](docs/adr/0006-workers-builds-delivery.md).

No copies el contenido de un ADR al PR: linkealo.

## Pull requests

- Título claro; descripción en **español** con First Principles:
  - Problema
  - Restricciones y verdades
  - Razonamiento
  - Solución
  - Trade-offs
  - Verificación
- Una idea por ítem; pensado para lectura rápida.
- PR visuales: incluir slides o video (sin alargar el proceso en la descripción).
- No mergear a `main` sin OK explícito de Juan. Deploys: Jack (operaciones).

## Flujo de ramas

- `main` solo se promueve con OK explícito de Juan.
- Los deploys los hace Jack.
- Sin ese OK: no mergear.

## UI y estilos

- Tailwind CSS 4; tokens en [`packages/ui/src/styles/globals.css`](packages/ui/src/styles/globals.css); tipografía Geist.
- No agregues divisores de 1px (`border-t` / `border-b` de 1px, `hr`, `divide-*`, `h-px` / `w-px`). Separá con espaciado o tono de superficie.
- Única excepción hoy: la línea sobre el botón «Cargar más» de `/trabajo`.
- shadcn/ui solo si el proyecto lo justifica (`pnpm ui:add`).

## Motion

Base: skills de Emil Kowalski. Adaptar a Astro + Tailwind + CSS. Al copiar ejemplos, quitá los comentarios.

- Animá solo con propósito claro.
- UI por debajo de **300 ms**.
- Sin `ease-in` en UI.
- Nada de `scale(0)`: partí de `0.9`–`0.97` con opacity.
- Elementos pulsables: `:active` con `scale(0.97)`.
- No uses `transition: all`; preferí `transform` y `opacity`.
- Respetá `prefers-reduced-motion`.
- Hover solo con `(hover: hover)`.
- Easing como token CSS (`--ease-out`).

Ejemplo (Astro + CSS):

```css
:root {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
}

@media (prefers-reduced-motion: no-preference) {
  .pressable {
    transition:
      transform 160ms var(--ease-out),
      opacity 160ms var(--ease-out);
  }

  .pressable:active {
    transform: scale(0.97);
  }

  .enter {
    opacity: 0;
    transform: scale(0.96);
  }

  .enter.is-visible {
    opacity: 1;
    transform: scale(1);
  }
}

@media (hover: hover) and (prefers-reduced-motion: no-preference) {
  .pressable:hover {
    opacity: 0.92;
  }
}
```

Ejemplo (Tailwind, mismas ideas):

```html
<button
  class="transition-[transform,opacity] duration-150 ease-[var(--ease-out)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 [@media(hover:hover)]:hover:opacity-90"
>
  Continuar
</button>
```

## Anti-patrones (Impeccable)

- Antes de pedir review: `impeccable detect`.
- Usá Impeccable solo para: `detect`, `audit`, `critique`, `polish`, `adapt`, `optimize`.
- No uses modos `live`, `generate`, hooks, `install` ni `update`.
- No commitees `.impeccable/`, `PRODUCT.md` ni `DESIGN.md`.
- Si el CLI no está en el entorno: instalalo/usalo según la doc de Impeccable; no inventes scripts en `package.json` del repo.

## Contenido

- Español primero (rioplatense en UI y docs de producto).
- Versión en inglés solo cuando el español esté terminado.
