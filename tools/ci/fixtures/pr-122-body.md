<!-- CURSOR_AGENT_PR_BODY_BEGIN -->
## Problema
Juan pidió sacar el indicador naranja del ítem activo del menú del header (nunca se pidió) y que el botón «Enviar» de `/contacto` deje de ser naranja. Follow-ups: el checkbox solo no debe habilitar «Enviar»; el checkbox de consentimiento debe ser negro (no naranja).

## Restricciones y verdades
- Rama nueva desde `main` (`6d34c37`).
- Sin cambios de copy, sin tocar Turnstile/handler, sin force-push, sin merge, sin deploy.
- Validación server-side intacta.

## Razonamiento
El subrayado activo era `border-bottom` naranja en `.site-header__nav-link[aria-current="page"]`. El botón usaba `#c2410c` / `#9a3412`. El gating de «Enviar» solo miraba `consent.checked`. El checkbox usaba `accent-color` / focus naranja.

## Solución
- Eliminar la regla de subrayado activo del header; se mantiene `aria-current` para a11y.
- Pasar «Enviar» a fondo `#0a0a0a`, hover `#262624`, focus ring monocromo; disabled ya era gris.
- Habilitar «Enviar» solo si hay consentimiento **y** todos los requeridos pasan las mismas reglas client-side (`checkValidity` + trim). Re-deshabilita al invalidar/limpiar o desmarcar.
- Checkbox de consentimiento monocromo: `accent-color: #0a0a0a` (checkmark blanco del UA), focus `#0a0a0a`, hover sin naranja.

## Trade-offs
- El ítem activo del nav ya no tiene marca visual propia (solo `aria-current`).
- El hint «Para enviar, aceptá…» sigue visible (sin cambio de copy).
- El PR de lint de CTAs (#125) dejó el checkbox como no-CTA; este cambio vive acá igual.

## Verificación
- `pnpm lint` OK
- `pnpm check` OK
- `pnpm test` OK (179)
- `test:contract` OK (97)
- `test:e2e` OK (158)
- `prettier --check` OK
- Capturas nav/Enviar/gating/checkbox en `/opt/cursor/artifacts`
<!-- CURSOR_AGENT_PR_BODY_END -->

<div><a href="https://cursor.com/agents/bc-cef9e855-2adf-5013-b21e-9e77c42d8d99?cursor_ref=pr_footer&cursor_cta=open_in_web"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cursor.com/assets/images/open-in-web-dark.png"><source media="(prefers-color-scheme: light)" srcset="https://cursor.com/assets/images/open-in-web-light.png"><img alt="Open in Web" width="114" height="28" src="https://cursor.com/assets/images/open-in-web-dark.png"></picture></a>&nbsp;<a href="https://cursor.com/background-agent?bcId=bc-cef9e855-2adf-5013-b21e-9e77c42d8d99&cursor_ref=pr_footer&cursor_cta=open_in_cursor"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cursor.com/assets/images/open-in-cursor-dark.png"><source media="(prefers-color-scheme: light)" srcset="https://cursor.com/assets/images/open-in-cursor-light.png"><img alt="Open in Cursor" width="131" height="28" src="https://cursor.com/assets/images/open-in-cursor-dark.png"></picture></a>&nbsp;</div>


