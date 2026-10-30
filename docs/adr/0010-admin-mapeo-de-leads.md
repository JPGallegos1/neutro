# ADR 0010: Admin · Mapeo de leads (MVP)

## Status

Accepted (2026-10-30). Juan OK via Hamilton (t361u / t362u).

El MVP de Mapeo de leads ya está en `main` (issues #87–#93, PRs de merge #94–#101). Este ADR deja constancia de la decisión arquitectónica que gobernó esa entrega. No amplía el alcance de producto.

Antes de mergear el ADR, la spec (#86) lo citaba como Proposed; el archivo no llegó a `main` durante la implementación. El estado pasa a Accepted porque el MVP ya shipped.

Arquitecto: Hamilton. App: `apps/admin` (Worker `neutro-admin`).

## Context

Outreach comercial en Neutro necesita descubrir comercios cerca de Rosario, priorizar los que no tienen website, guardarlos como Lead y hacer seguimiento básico (estado, notas, responsable) sin scrapear Google Maps ni montar un CRM. El sitio público (`apps/web`) no es esa superficie.

Infra ya provisionada por Jack al momento de la decisión: D1 `neutro-admin-leads`, Worker `neutro-admin`, DNS `admin.neutro.solutions`, Cloudflare Access ON. Vocabulario de producto: spec #86 (sección Admin del glossary queda diferida a un PR docs aparte; no se inventa acá).

## Decision

- **Bounded context Admin.** App `apps/admin` en el monorepo. No importa `apps/web` ni `apps/muestras`. Código compartido solo vía `packages/*`.
- **Borde.** Host `admin.neutro.solutions` detrás de Cloudflare Access. `noindex` / `nofollow` (meta y `X-Robots-Tag`). Badge interno y pie con identidad Access. Sin SEO público ni indexación.
- **Módulo MVP.** Sidebar «Mapeo de leads» → Comercios / Leads / Áreas. Un solo `useReducer` de shell; sin `useState` / `useEffect` en el contrato del esqueleto.
- **Persistencia.** D1 binding `DB` → `neutro-admin-leads`. Tablas del MVP: `search_areas`, `places` con `UNIQUE(source, external_id)` y `source IN ('foursquare', 'osm')`, `leads` con estados `nuevo` / `contactado` / `interesado` / `descartado`. Prohibido persistir columnas de negocio provenientes de Google Places.
- **Área de búsqueda.** Centro + radio 0,5–10 km (círculo por defecto; polígono opcional). Default operativo Rosario centro · 3 km. Varias áreas reutilizables. Sin multi-ciudad compleja en el MVP.
- **Comercios.** Foursquare Open Places + OSM/Overpass; identidad estable `source` + `external_id`; atribución de licencia; mapa sincronizado con lista. Filtro Sin website activo por defecto; Tiene redes; rubro; Ocultar ya guardados; multi-select.
- **Lead.** Guardar selección sin duplicar por `source` + `external_id`; estado inicial `nuevo`; notas; responsable solo desde identidad Access (`Cf-Access-Authenticated-User-Email` / flujo Access; el body no impone assignee arbitrario). Maps / WhatsApp externos a mano.
- **Google Places.** Solo vista en vivo (detalle); no escribe nombres ni direcciones de negocio en D1 ni en el CSV.
- **Export CSV.** Columnas mínimas del seam: `id`, `source`, `external_id`, `status`, `notes`, `assignee`, `sin_website`, `tiene_redes`. Cero columnas de negocio de Google Places.
- **Fitness / seam de test.** Un seam de casos de uso (descubrir → filtrar → guardar Lead → seguimiento → export → enriquecimiento en vivo sin persistir Google), más aislamiento Admin vs web/muestras. Access es borde, no el núcleo del seam. Los contratos viven en `apps/admin/src/contract/`.

### Fuera de alcance (sin inventar producto)

Scraping de Google Maps; persistir resultados de Google Places; CRM sync; campañas o envío de WhatsApp/email desde Neutro; multi-ciudad; roles distintos de admin; SEO de Admin; módulo Muestras activo; reprovisionar DNS/Worker/D1/Access; tipografía Geist en Admin (ticket diferido #96); Templates.

## Consequences

- Admin es un contexto aislado con su Worker y D1; un error de indexación o de dependencia cruzada se detecta con fitness de aislamiento y headers `noindex`.
- La identidad persistida queda atada a Foursquare/OSM; Google no contamina D1 ni CSV.
- El MVP en `main` cubre #87–#93. Pendientes explícitos post-MVP (Geist, claves live FSQ, refinamientos de rubro/UI) no cambian este ADR hasta una enmienda.
- Merge a `main` de cambios de Admin sigue el proceso del repo ([ADR 0007](0007-reglas-automaticas-y-verification-skill.md)); este documento no autoriza deploy.
