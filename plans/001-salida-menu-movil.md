# 001 — Completá la salida del menú móvil

- **Estado**: DONE
- **Commit de referencia**: `4852df4`
- **Severidad**: MEDIUM
- **Categoría**: continuidad espacial, interrupciones y accesibilidad
- **Alcance estimado**: 3 archivos; aproximadamente 150–300 líneas entre implementación y pruebas.

## Problema

El menú móvil tiene una entrada de 250 ms, pero desaparece inmediatamente al cerrar. La salida debe completar el recorrido de entrada sin retrasar la navegación ni las acciones por teclado.

En `apps/web/src/components/sections/MobileDrawer.astro:156`, el cierre actual es:

```ts
const close = () => {
  if (dialog.open) {
    dialog.close();
  }
};
```

En `apps/web/src/components/sections/MobileDrawer.astro:220`, la entrada actual es:

```css
.mobile-drawer[open] {
  display: block;
  animation: drawer-in var(--landing-ease-drawer) both;
}

@keyframes drawer-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

En `apps/web/src/styles/landing.css:16`, el token actual es:

```css
--landing-ease-drawer: 250ms ease;
```

La comprobación previa en Chrome, con viewport móvil de 390 × 844, encontró `open: false`, `display: none` y ninguna animación desde el primer frame posterior al clic en «Cerrar menú». Escape ya devuelve el foco a «Abrir menú».

## Objetivo

El menú debe entrar y salir por el mismo recorrido. La apertura conserva sus 250 ms; la salida es más breve: 160 ms. Ambas usan `cubic-bezier(0.23, 1, 0.32, 1)` como token compartido `--ease-out`.

| Acción                                           | Resultado                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| Abrir con clic o tap                             | `opacity: 0 → 1`, `translateY(-8px → 0)`, 250 ms.                  |
| Cerrar con clic o tap en la X                    | `opacity: actual → 0`, `translateY(actual → -8px)`, 160 ms.        |
| Cerrar antes de terminar de abrir                | La transición parte del estado visual actual; no vuelve al inicio. |
| Repetir el clic en cerrar                        | Conserva el cierre pendiente; no reinicia ni acumula callbacks.    |
| Escape, incluso durante la salida                | Cierre inmediato y cancelación del cierre pendiente.               |
| Activación por teclado de abrir o cerrar         | Respuesta inmediata, sin transición.                               |
| Elegir un enlace del menú                        | Cierre y navegación inmediatos, sin esperar la salida.             |
| Pasar a un viewport de 1024 px o más             | Cierre inmediato y devolución del foco a un control visible.       |
| Movimiento reducido, apertura/cierre por puntero | Solo `opacity`, 100 ms; sin desplazamiento.                        |

Los 8 px reproducen el recorrido existente: no son una nueva distancia de diseño. La curva procede de `improve-animations/AUDIT.md`, sección «Easing & duration». Los 160 ms de salida y 100 ms de fade reducido son los valores seleccionados en el informe de oportunidades.

## Convenciones del repositorio

- Astro y CSS con script TypeScript local; conservar `<dialog>` y `showModal()` para mantener modalidad y gestión nativa del foco.
- Tokens de la landing en `apps/web/src/styles/landing.css:1`.
- La curva ya existe localmente en `apps/web/src/components/sections/WorkCasePage.astro:151`: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`. Agregar esa misma definición al `:root` de la landing; no crear otra curva equivalente con otro nombre.
- Conservar `AbortController`, `setExpanded()` y `focusVisibleControl()` del drawer.
- Animar únicamente `transform` y `opacity`; usar transiciones para poder interrumpirlas.
- Código fuente sin comentarios; requisitos en `AGENTS.md` y [ADR 0003](../docs/adr/0003-no-source-comments.md).
- No agregar dependencias ni divisores visuales.

## Pasos

### 1. Declarar los tokens de movimiento

En `apps/web/src/styles/landing.css`, agregar `--ease-out` y actualizar el token de apertura. Agregar tokens para salida y fade reducido:

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--landing-ease-drawer: 250ms var(--ease-out);
--landing-ease-drawer-exit: 160ms var(--ease-out);
--landing-ease-drawer-reduced: 100ms var(--ease-out);
```

### 2. Hacer reversible el estado visual del drawer

En el estilo de `MobileDrawer.astro`, reemplazar `drawer-in` por transiciones. Conservar los estilos de dimensiones y composición del diálogo. El estado abierto normal es `opacity: 1; transform: translateY(0)`.

Usar `@starting-style` para el estado inicial de la apertura por puntero: `opacity: 0; transform: translateY(-8px)`. La transición de apertura usa `--landing-ease-drawer` en ambas propiedades.

Agregar el selector `.mobile-drawer[open][data-closing]`, con `opacity: 0; transform: translateY(-8px)` y transiciones con `--landing-ease-drawer-exit`.

Usar un atributo `data-instant` para las activaciones por teclado: excluirlo del estado inicial animado y desactivar sus transiciones. El selector de respuesta inmediata debe prevalecer también bajo movimiento reducido.

En `prefers-reduced-motion: reduce`, mantener `transform: none` tanto en el estado inicial como en el abierto y el cierre. Transicionar solo `opacity` con `--landing-ease-drawer-reduced`.

La regla global en `landing.css:115` fuerza `transition-duration: 0.01ms !important`. Para conservar el fade de 100 ms, agregar una excepción específica del drawer con `transition-duration: 100ms !important` dentro de su media query. No modificar el comportamiento global de otros componentes. La respuesta inmediata por teclado mantiene `transition: none !important` con prioridad sobre esta excepción.

### 3. Coordinar el cierre con el ciclo de vida de `<dialog>`

En el script de `MobileDrawer.astro`, distinguir solicitud de cierre animado y cierre inmediato.

1. Para el botón de cierre y el clic directo sobre el diálogo, usar el cierre animado únicamente si el evento corresponde a puntero (`MouseEvent.detail > 0`). No usar la detección global de dispositivo como sustituto de la modalidad de esa activación.
2. Antes de iniciar la salida, retirar cualquier estado instantáneo heredado y resolver el estilo actual. Agregar `data-closing` sin invocar todavía `dialog.close()`. Mantener modalidad, bloqueo de scroll y `aria-expanded="true"` durante los 160 ms, o 100 ms con movimiento reducido.
3. Completar el cierre al terminar la transición de `opacity`, filtrando `event.target === dialog` y `event.propertyName === "opacity"`. Ignorar eventos de descendientes y de `transform`.
4. Agregar un fallback de 200 ms para no depender exclusivamente de `transitionend`. Si no existe transición efectiva, finalizar inmediatamente. Limpiar listener y timer al completar, cancelar o reinicializar.
5. Mantener un único cierre pendiente, con un identificador que invalide callbacks antiguos. Si se solicita abrir durante una salida pendiente, cancelarla y retirar `data-closing`: la transición debe volver hacia el estado abierto desde su posición actual.
6. Usar cierre inmediato para enlaces, cambio al breakpoint desktop y activaciones por teclado. Conservar la acción nativa de `cancel` para Escape y limpiar también ahí cualquier cierre pendiente; no bloquear Escape con `preventDefault()`.
7. La apertura por teclado usa `data-instant` antes de `showModal()`; la apertura por puntero retira ese atributo. Detectar la modalidad mediante el evento de activación.
8. En el evento `close`, limpiar atributos y cierre pendiente, ejecutar `setExpanded(false)` y conservar `focusVisibleControl(openBtn)`. Ningún callback de una apertura anterior debe cerrar una apertura posterior.
9. Vincular la limpieza al `AbortController` existente para que `astro:page-load` no deje callbacks viejos activos.

El cierre visual no debe basarse en `display` ni en remover `open` antes de terminar. La devolución del foco ocurre al cerrarse el diálogo, no al empezar a desaparecer.

### 4. Cubrir el comportamiento con Playwright

Agregar `apps/web/e2e/mobile-drawer.spec.ts`, siguiendo la configuración existente. Son pruebas de comportamiento del diálogo, no verificaciones del texto del CSS.

- Viewport de 390 × 844: apertura, cierre por X y foco devuelto a «Abrir menú».
- Capturar la transición de cierre con Web Animations API y pausarla para comprobar que el diálogo permanece modal/abierto mientras la salida está pendiente; al finalizar, queda cerrado y libera el scroll.
- Clic de cierre durante la apertura y doble clic de cierre: sin estados trabados ni errores.
- Escape durante la salida: cierra inmediatamente, sin esperar la transición; después se puede abrir y el callback anterior no lo vuelve a cerrar.
- Abrir/cerrar con Enter o Espacio: sin transiciones pendientes; enlaces de navegación funcionan sin esperar el fade.
- Pasar a 1024 px durante la salida: se cierra y el foco queda en un control visible.
- `reducedMotion: "reduce"`: sin transformaciones en apertura ni salida; fade de 100 ms por puntero y cierre completo.
- Evitar sleeps fijos para sincronizar estados; usar eventos, promesas de animación y aserciones de estado.

## Límites

- Alcance de implementación: `MobileDrawer.astro`, `landing.css` y la nueva prueba del drawer.
- Conservar el contenido, dimensiones, posiciones y marcado semántico del menú.
- Las otras oportunidades del informe —feedback de presión y flecha del acordeón— quedan en trabajos independientes.
- Si el código difiere del commit de referencia en los puntos citados, actualizar primero el plan con evidencia de ese cambio.

## Verificación

### Mecánica

Desde la raíz del repositorio:

```sh
pnpm check
pnpm lint
pnpm build
pnpm --filter @neutro/web test:e2e e2e/mobile-drawer.spec.ts
pnpm --filter @neutro/web test:e2e e2e/a11y.spec.ts
pnpm exec prettier --check apps/web/src/components/sections/MobileDrawer.astro apps/web/src/styles/landing.css apps/web/e2e/mobile-drawer.spec.ts plans/001-salida-menu-movil.md plans/README.md
```

Resultado esperado: tipos y lint sin errores, build completo, pruebas funcionales y de accesibilidad aprobadas y formato válido. Playwright usa el build servido por `astro preview` en el puerto 4173; el servidor de desarrollo del usuario permanece en 4321. Si falta el navegador de Playwright, instalar el Chromium requerido por la versión fijada antes de ejecutar las pruebas.

### Comprobación perceptual

- En `http://localhost:4321`, a 390 px y 768 px: abrir y cerrar con la X. La salida debe subir apenas 8 px y desaparecer de manera continua, sin salto final.
- Cerrar durante la entrada: no debe reaparecer primero ni saltar a la posición totalmente abierta.
- Reducir la velocidad al 10 % en DevTools → Animations. Confirmar continuidad del recorrido y que el foco no salta detrás de una capa todavía visible.
- Probar Escape y activaciones por teclado: respuesta inmediata, incluyendo durante una salida ya iniciada.
- Emular movimiento reducido: solo fade de 100 ms por puntero, sin desplazamiento.
- Confirmar en un teléfono real la respuesta al tap. Registrar expresamente si solo se pudo verificar en emulación.
- Capturar un video breve del antes/después para el PR visual.
- Antes de pedir review, ejecutar `impeccable detect` según `AGENTS.md`; registrar disponibilidad y resultado.

### Terminado cuando

El cierre por X tiene una salida continua de 160 ms; el modo reducido conserva un fade de 100 ms; teclado, Escape, enlaces y breakpoint desktop responden inmediatamente. Las interrupciones no dejan el diálogo, el foco o el bloqueo de scroll trabados. Las comprobaciones mecánicas y perceptuales están registradas y el cambio pasó una revisión con el criterio de `review-animations`.

## Resultado de implementación

- Implementado sobre `4852df4`, en el árbol de trabajo de la rama del PR #105.
- `pnpm check`, `pnpm lint` y `pnpm build`: exit 0 con Node 24.18.0 y pnpm 12.14.0.
- `pnpm --filter @neutro/web test:e2e e2e/mobile-drawer.spec.ts`: 8 pruebas aprobadas.
- `pnpm --filter @neutro/web test:e2e e2e/a11y.spec.ts`: 50 pruebas aprobadas.
- Axe con el diálogo abierto: sin violaciones en claro ni oscuro.
- Detector Impeccable ejecutado mediante el script de la skill: resultado `[]`; el ejecutable `impeccable` no está en PATH.
- Inspección por frames en Chrome a 390 y 768 px: recorrido continuo de 0 a -8 px, opacidad decreciente y foco conservado dentro del diálogo hasta completar la salida. Al terminar, foco en «Abrir menú» y scroll liberado.
- Capturas en claro y oscuro, desktop y móvil, captura con movimiento reducido y video de la implementación en `evidencia/105-4852df4-menu-movil/` (directorio ignorado por Git).
- Revisión de animaciones: frecuencia ocasional y propósito de continuidad espacial; solo transform y opacidad; entrada de 250 ms y salida de 160 ms, con curva compartida; teclado inmediato y movimiento reducido de 100 ms; sin hallazgos nuevos en el cambio.
- Verificación realizada en Chromium y emulación de viewport. Pendiente la comprobación en un teléfono físico y la revisión con ojos frescos al día siguiente.
