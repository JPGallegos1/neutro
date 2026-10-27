---
status: proposed
---

# Un solo orden manual de casos para landing, listado y «Más trabajo»

Los casos se ordenan a mano en un único lugar de datos, y ese orden lo usan la landing, el listado y «Más trabajo» (sin el caso de la ficha). La regla es «un caso nuevo va al final»: no hay selección de destacados por lugar ni orden por fecha. La landing muestra siempre los primeros 4 casos del orden y el listado empieza por esos mismos, así que las tres superficies muestran lo mismo en la misma secuencia y el `ItemList` de `/trabajo` ([ADR 0005](0005-trabajo-routing-and-seo.md), «display order») sale de esa lista. El costo es que reordenar es una decisión editorial manual.

No hay un motivo de negocio específico para que el orden sea manual ni para que Luxury Cars quede fuera de los casos iniciales (Juan, 26/10/2026): hoy queda afuera solo porque es el último de la lista. Si aparece un motivo, se registra acá. La landing tampoco lleva enlace ni botón extra hacia el listado: solo el menú, y se quita el enlace «Ver todos».

«Más trabajo» muestra todos los demás casos publicados, en este orden y en 2 columnas, sin tope. Esto reemplaza la línea «2–3 related cases» del ADR 0005 (tabla de rutas y sección de la ficha) y también la regla intermedia de «los 4 casos ajenos». El contrato exacto de «Más trabajo» lo fija la enmienda SEO-15 de ese ADR, no este documento. El umbral de 12 casos del ADR 0005 sigue vigente.

## Consecuencias

- Con 5 casos, Luxury Cars no aparece en la landing: se ve en el listado después de «Cargar más» y en «Más trabajo». Un caso nuevo queda igual hasta que se lo suba en el orden.
- «Más trabajo» crece con cada caso nuevo: con 5 casos muestra 4 (2×2) y con 6 muestra 5, con el último solo en una fila.
- Reordenar cambia a la vez la landing, el orden del listado, el `ItemList` y «Más trabajo». Los tests de contrato que fijan los casos iniciales tienen que leer el mismo orden en lugar de repetirlo.
