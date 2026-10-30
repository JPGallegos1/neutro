import { useRouter } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useAdmin } from "@/admin-context";
import { getAreasClient } from "@/areas-client";
import {
  SEARCH_AREA_RADIUS_MAX_KM,
  SEARCH_AREA_RADIUS_MIN_KM,
  draftToCreateInput,
  type SearchArea,
  type SearchAreaValidationError,
} from "@/search-area";

const field =
  "rounded-md bg-neutro-bg px-3 py-2 text-sm ring-1 ring-neutro-border focus:ring-2 focus:ring-neutro-accent-blue";

function msg(
  error: SearchAreaValidationError | "persist_failed" | null,
): string | null {
  if (error === "name_required") return "Nombre obligatorio.";
  if (error === "radius_out_of_bounds") {
    return `Radio ${SEARCH_AREA_RADIUS_MIN_KM}–${SEARCH_AREA_RADIUS_MAX_KM} km.`;
  }
  if (error === "center_invalid") return "Centro inválido.";
  if (error === "polygon_required") return "Polígono obligatorio.";
  if (error === "polygon_invalid") return "Polígono JSON inválido.";
  if (error === "persist_failed") return "No se pudo guardar.";
  return null;
}

export function AreasPage({
  loadedAreas,
  loadedRevision,
}: {
  loadedAreas: SearchArea[];
  loadedRevision: number;
}) {
  const { state, dispatch } = useAdmin();
  const router = useRouter();
  if (state.areasRevision !== loadedRevision || state.areasStatus === "idle") {
    dispatch({
      type: "areasHydrated",
      areas: loadedAreas,
      revision: loadedRevision,
    });
  }
  const alert = msg(state.areasError);
  const saving = state.areasStatus === "saving";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = draftToCreateInput(state.draft);
    if (!parsed.ok) {
      dispatch({ type: "saveAreaFailed", error: parsed.error });
      return;
    }
    dispatch({ type: "saveAreaRequested" });
    try {
      const area = await getAreasClient().create(parsed.value);
      dispatch({
        type: "saveAreaSucceeded",
        area,
        revision: state.areasRevision + 1,
      });
      await router.invalidate();
    } catch {
      dispatch({ type: "saveAreaFailed", error: "persist_failed" });
    }
  }

  return (
    <section className="flex flex-1 flex-col gap-6 p-6" data-admin-areas-page>
      <h1 className="text-2xl font-medium tracking-tight">Áreas de búsqueda</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col gap-2" data-admin-areas-list>
            {state.areas.map((area) => (
              <li key={area.id}>
                <button
                  type="button"
                  data-admin-area-id={area.id}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                    state.selectedAreaId === area.id
                      ? "bg-neutro-surface"
                      : "bg-neutro-bg text-neutro-text-muted"
                  }`}
                  onClick={() => dispatch({ type: "selectArea", id: area.id })}
                >
                  <span className="font-medium text-neutro-text">
                    {area.name}
                  </span>
                  <span className="block text-xs">
                    {area.radiusKm} km · {area.shape}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="self-start rounded-md bg-neutro-surface px-3 py-2 text-sm"
            onClick={() => dispatch({ type: "resetDraft" })}
          >
            Nueva desde Rosario · 3 km
          </button>
        </div>
        <form
          className="flex flex-col gap-3 rounded-md bg-neutro-surface p-4"
          data-admin-area-form
          onSubmit={onSubmit}
        >
          <input
            className={field}
            aria-label="Nombre"
            value={state.draft.name}
            onChange={(e) =>
              dispatch({ type: "draftName", name: e.target.value })
            }
            required
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className={field}
              aria-label="Lat"
              value={state.draft.centerLat}
              onChange={(e) =>
                dispatch({ type: "draftCenterLat", centerLat: e.target.value })
              }
              required
            />
            <input
              className={field}
              aria-label="Lng"
              value={state.draft.centerLng}
              onChange={(e) =>
                dispatch({ type: "draftCenterLng", centerLng: e.target.value })
              }
              required
            />
          </div>
          <input
            className={field}
            aria-label="Radio km"
            value={state.draft.radiusKm}
            onChange={(e) =>
              dispatch({ type: "draftRadiusKm", radiusKm: e.target.value })
            }
            required
          />
          <select
            className={field}
            aria-label="Forma"
            value={state.draft.shape}
            onChange={(e) =>
              dispatch({
                type: "draftShape",
                shape: e.target.value === "polygon" ? "polygon" : "circle",
              })
            }
          >
            <option value="circle">Círculo</option>
            <option value="polygon">Polígono</option>
          </select>
          {state.draft.shape === "polygon" ? (
            <textarea
              className={`${field} min-h-24 font-mono text-xs`}
              aria-label="Polígono JSON"
              value={state.draft.polygonText}
              onChange={(e) =>
                dispatch({
                  type: "draftPolygonText",
                  polygonText: e.target.value,
                })
              }
            />
          ) : null}
          {alert ? (
            <p className="text-sm text-neutro-accent-orange" role="alert">
              {alert}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-neutro-accent-orange px-3 py-2 text-sm font-medium text-neutro-on-orange disabled:opacity-60"
          >
            {saving ? "Guardando…" : "Guardar Área de búsqueda"}
          </button>
        </form>
      </div>
    </section>
  );
}
