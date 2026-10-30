import { useAdmin } from "@/admin-context";
import { getAreasClient } from "@/areas-client";
import { COMERCIOS_ATTRIBUTION, comercioKey, type Comercio } from "@/comercio";
import { getComerciosClient } from "@/comercios-client";
import { ComerciosMap } from "@/comercios-map";
import { ROSARIO_CENTER } from "@/search-area";

export function ComerciosPage({
  loadedComercios,
  loadedRevision,
}: {
  loadedComercios: Comercio[];
  loadedRevision: number;
}) {
  const { state, dispatch } = useAdmin();
  const comercios =
    state.comerciosStatus === "idle" ? loadedComercios : state.comercios;
  const selectedKey =
    state.selectedComercioKey ??
    (comercios[0] ? comercioKey(comercios[0]) : null);

  const center = state.selectedAreaId
    ? (state.areas.find((a) => a.id === state.selectedAreaId)?.center ??
      ROSARIO_CENTER)
    : ROSARIO_CENTER;

  function hydrateFromLoader() {
    if (state.comerciosStatus !== "idle") return;
    dispatch({
      type: "comerciosHydrated",
      comercios: loadedComercios,
      revision: loadedRevision,
    });
  }

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

  function onSelect(key: string) {
    hydrateFromLoader();
    dispatch({ type: "selectComercio", key });
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
        <button
          type="button"
          className="rounded-md bg-neutro-accent-orange px-3 py-2 text-sm font-medium text-neutro-on-orange"
          onClick={onBuscar}
          disabled={state.comerciosStatus === "searching"}
        >
          {state.comerciosStatus === "searching"
            ? "Buscando…"
            : "Buscar en el Área"}
        </button>
      </header>
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <ComerciosMap
          comercios={comercios}
          selectedKey={selectedKey}
          leadKeys={state.leadKeys}
          center={center}
          onSelect={onSelect}
        />
        <ul
          className="flex max-h-[28rem] flex-col gap-2 overflow-auto"
          data-admin-comercios-list
        >
          {comercios.map((c) => {
            const key = comercioKey(c);
            const selected = selectedKey === key;
            return (
              <li key={key}>
                <button
                  type="button"
                  data-admin-comercio-key={key}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                    selected
                      ? "bg-neutro-surface"
                      : "bg-neutro-bg text-neutro-text-muted"
                  }`}
                  onClick={() => onSelect(key)}
                >
                  <span className="font-medium text-neutro-text">{c.name}</span>
                  <span className="block text-xs">
                    {c.source} · {c.externalId}
                    {c.website ? " · web" : " · sin website"}
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
