import { useAdmin } from "@/admin-context";
import { getAreasClient } from "@/areas-client";
import {
  COMERCIOS_ATTRIBUTION,
  NEUTRO_RUBROS,
  comercioKey,
  countVisibleSelected,
  filterComercios,
  type Comercio,
  type NeutroRubro,
} from "@/comercio";
import { getComerciosClient } from "@/comercios-client";
import { ComerciosMap } from "@/comercios-map";
import { getLeadsClient } from "@/leads/leads-client";
import { leadKey, type Lead } from "@/leads/lead";
import { ROSARIO_CENTER } from "@/search-area";

export function ComerciosPage({
  loadedComercios,
  loadedRevision,
  loadedLeads,
  loadedLeadsRevision,
}: {
  loadedComercios: Comercio[];
  loadedRevision: number;
  loadedLeads: Lead[];
  loadedLeadsRevision: number;
}) {
  const { state, dispatch } = useAdmin();
  const all =
    state.comerciosStatus === "idle" ? loadedComercios : state.comercios;
  const activeLeadKeys =
    state.leadsStatus === "idle"
      ? new Set(loadedLeads.map(leadKey))
      : state.leadKeys;
  const filteredComercios = filterComercios(all, state.filters, activeLeadKeys);
  const visibleSelectedCount = countVisibleSelected(
    state.selectedComercioKeys,
    filteredComercios,
  );

  const center = state.selectedAreaId
    ? (state.areas.find((a) => a.id === state.selectedAreaId)?.center ??
      ROSARIO_CENTER)
    : ROSARIO_CENTER;

  async function onBuscar() {
    dispatch({ type: "comerciosSearchRequested" });
    try {
      const area =
        state.areas.find((a) => a.id === state.selectedAreaId) ??
        (await getAreasClient().list())[0];
      const found = await getComerciosClient().search({
        lat: area?.center.lat ?? ROSARIO_CENTER.lat,
        lng: area?.center.lng ?? ROSARIO_CENTER.lng,
        radiusKm: area?.radiusKm ?? 3,
      });
      dispatch({
        type: "comerciosSearchSucceeded",
        comercios: found,
        revision: Math.max(state.comerciosRevision, loadedRevision) + 1,
      });
    } catch {
      dispatch({ type: "comerciosSearchFailed" });
    }
  }

  async function onGuardar() {
    const selected = all.filter((item) =>
      state.selectedComercioKeys.has(comercioKey(item)),
    );
    if (selected.length === 0) return;
    dispatch({ type: "saveLeadsRequested" });
    try {
      const leads = await getLeadsClient().save(selected);
      dispatch({
        type: "saveLeadsSucceeded",
        leads,
        revision: Math.max(state.leadsRevision, loadedLeadsRevision) + 1,
      });
    } catch {
      dispatch({ type: "saveLeadsFailed" });
    }
  }

  function onSelect(key: string) {
    if (state.comerciosStatus === "idle") {
      dispatch({
        type: "toggleComercio",
        key,
        seed: { comercios: loadedComercios, revision: loadedRevision },
      });
      return;
    }
    dispatch({ type: "toggleComercio", key });
  }

  return (
    <section
      className="flex flex-1 flex-col gap-4 p-6"
      data-admin-comercios-page
      aria-label="Comercios"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Comercios</h1>
          <p className="text-sm text-neutro-text-muted">
            Foursquare Open Places + OSM · identidad source + external_id
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-admin-guardar-leads
            className="rounded-md bg-neutro-accent-orange px-3 py-2 text-sm font-medium text-neutro-on-orange disabled:opacity-40"
            onClick={onGuardar}
            disabled={
              visibleSelectedCount === 0 || state.leadsStatus === "saving"
            }
          >
            {state.leadsStatus === "saving"
              ? "Guardando…"
              : "Guardar como Lead"}
          </button>
          <button
            type="button"
            className="rounded-md bg-neutro-surface px-3 py-2 text-sm font-medium text-neutro-text"
            onClick={onBuscar}
            disabled={state.comerciosStatus === "searching"}
          >
            {state.comerciosStatus === "searching"
              ? "Buscando…"
              : "Buscar en el Área"}
          </button>
        </div>
      </header>
      <div
        className="flex flex-wrap items-center gap-3 text-sm"
        data-admin-comercios-filters
        role="group"
        aria-label="Filtros"
      >
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            data-admin-filter="sin-website"
            checked={state.filters.sinWebsite}
            onChange={(e) =>
              dispatch({
                type: "setComerciosFilters",
                filters: { sinWebsite: e.target.checked },
              })
            }
          />
          Sin website
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            data-admin-filter="tiene-redes"
            checked={state.filters.tieneRedes}
            onChange={(e) =>
              dispatch({
                type: "setComerciosFilters",
                filters: { tieneRedes: e.target.checked },
              })
            }
          />
          Tiene redes
        </label>
        <label className="inline-flex items-center gap-2">
          Rubro
          <select
            className="rounded-md bg-neutro-bg px-2 py-1 text-sm"
            data-admin-filter="rubro"
            value={state.filters.rubro ?? ""}
            onChange={(e) =>
              dispatch({
                type: "setComerciosFilters",
                filters: {
                  rubro: (e.target.value || null) as NeutroRubro | null,
                },
              })
            }
          >
            <option value="">Todos</option>
            {NEUTRO_RUBROS.map((rubro) => (
              <option key={rubro} value={rubro}>
                {rubro}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            data-admin-filter="ocultar-guardados"
            checked={state.filters.ocultarGuardados}
            onChange={(e) =>
              dispatch({
                type: "setComerciosFilters",
                filters: { ocultarGuardados: e.target.checked },
              })
            }
          />
          Ocultar ya guardados
        </label>
        <span
          className="text-xs text-neutro-text-muted"
          data-admin-selection-count
        >
          {visibleSelectedCount} seleccionados
        </span>
      </div>
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <ComerciosMap
          comercios={filteredComercios}
          selectedKeys={state.selectedComercioKeys}
          leadKeys={activeLeadKeys}
          center={center}
          onSelect={onSelect}
        />
        <ul
          className="flex max-h-[28rem] flex-col gap-2 overflow-auto"
          data-admin-comercios-list
        >
          {filteredComercios.map((item) => {
            const key = comercioKey(item);
            const selected = state.selectedComercioKeys.has(key);
            return (
              <li key={key}>
                <button
                  type="button"
                  data-admin-comercio-key={key}
                  aria-pressed={selected}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                    selected
                      ? "bg-neutro-surface"
                      : "bg-neutro-bg text-neutro-text-muted"
                  }`}
                  onClick={() => onSelect(key)}
                >
                  <span className="font-medium text-neutro-text">
                    {item.name}
                  </span>
                  <span className="block text-xs">
                    {item.source} · {item.externalId}
                    {item.website ? " · web" : " · sin website"}
                    {item.socialUrls.length > 0 ? " · redes" : ""}
                    {` · ${item.rubro}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <p
        className="text-xs text-neutro-text-muted"
        data-admin-comercios-attribution
      >
        {COMERCIOS_ATTRIBUTION}
      </p>
    </section>
  );
}
