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

No copies el contenido de un ADR al PR: linkealo.

## Secretos

- El hook `tools/git-hooks/pre-commit` corre en cada commit: `gitleaks git --pre-commit --staged --redact` y bloquea `.env`, `.env.*`, `.dev.vars` y `.dev.vars.*` que no terminen en `.example`.
- `pnpm install` deja `core.hooksPath` en `tools/git-hooks` (`prepare`) cuando el cwd es la raíz de ese repo. Con `CI=true`, desde un subdirectorio, o si `git config` falla, el install sigue y no escribe la config de un repo padre.
- Si `gitleaks` no está en el PATH, el hook avisa cómo instalar la 8.30.1 y el commit sigue. Si está y encuentra un secreto, el commit falla. El chequeo de `.env` staged bloquea siempre. El CI escanea con el binario fijado por sha256.

## Pull requests

- Títulos al estilo de los PR recientes: Conventional Commits con tipo y scope cuando aplica (`feat(web):`, `fix(web):`, `docs:`, `style:`), en español, cortos.
- Descripción en **español** con First Principles:
  - Problema
  - Restricciones y verdades
  - Razonamiento
  - Solución
  - Trade-offs
  - Verificación
- Una idea por ítem; pensado para lectura rápida.
- PR visuales: incluir slides o video (sin alargar el proceso en la descripción).
- Si un cambio pasa de 10 archivos, se divide en PRs apilados o secuenciales ([ADR 0004](docs/adr/0004-max-pr-files.md)).

## Verificación

- La verification skill del sitio está en [`.cursor/skills/verify-web/SKILL.md`](.cursor/skills/verify-web/SKILL.md). Plantilla del informe: [`.cursor/skills/verify-web/plantilla-informe.md`](.cursor/skills/verify-web/plantilla-informe.md).
- Qué regla va a qué mecanismo, Playwright como base, y por qué la protección de rama no se activa: [ADR 0007](docs/adr/0007-reglas-automaticas-y-verification-skill.md) (Aceptado).
- El verificador deja el informe a Lucy. No comenta en el PR, no publica y no mergea.

## Flujo de ramas

- Sin OK explícito de Juan: no se mergea a `main`.
- Los deploys los hace Jack (operaciones).
- El [ADR 0006](docs/adr/0006-workers-builds-delivery.md) (Propuesto) define `staging` antes de `main`: PRs a `staging`, promoción `staging` → `main` solo con ese OK, y producción vía Workers Builds desde `main`.
- Hoy `staging` todavía no existe; se promueve a `main` directo.

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
- No uses los modos/comandos de Impeccable `live`, `generate`, hooks, `install` ni `update` (eso no es «instalar el CLI»).
- Instalar el CLI de Impeccable en la máquina local de cada quien está bien; no lo agregues al `package.json` del repo.
- No commitees `.impeccable/`, `PRODUCT.md` ni `DESIGN.md`.

## Contenido

- Español primero (rioplatense en UI y docs de producto).
- Versión en inglés solo cuando el español esté terminado.
