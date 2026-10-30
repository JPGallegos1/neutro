import { useRouter } from "@tanstack/react-router";
import type { FormEvent, ReactNode } from "react";
import { useAdmin } from "@/admin-context";
import { getAreasClient } from "@/areas-client";
import {
  SEARCH_AREA_RADIUS_MAX_KM,
  SEARCH_AREA_RADIUS_MIN_KM,
  draftToCreateInput,
  type SearchArea,
  type SearchAreaValidationError,
} from "@/search-area";

function errorMessage(
  error: SearchAreaValidationError | "persist_failed" | null,
): string | null {
  switch (error) {
    case "name_required":
      return "El nombre del Área de búsqueda es obligatorio.";
    case "radius_out_of_bounds":
      return `El radio debe estar entre ${SEARCH_AREA_RADIUS_MIN_KM} y ${SEARCH_AREA_RADIUS_MAX_KM} km.`;
    case "center_invalid":
      return "El centro (lat/lng) no es válido.";
    case "polygon_required":
      return "El polígono es obligatorio cuando la forma es polígono.";
    case "polygon_invalid":
      return "El polígono debe ser un JSON con al menos 3 puntos {lat,lng}.";
    case "persist_failed":
      return "No se pudo guardar el Área de búsqueda.";
    default:
      return null;
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-neutro-text-muted">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "rounded-md bg-neutro-bg px-3 py-2 text-sm text-neutro-text outline-none ring-1 ring-neutro-border focus:ring-2 focus:ring-neutro-accent-blue";

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

  const message = errorMessage(state.areasError);
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
    <section
      className="flex flex-1 flex-col gap-8 p-6"
      data-admin-areas-page
      aria-label="Áreas de búsqueda"
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-medium tracking-tight text-neutro-text">
          Áreas de búsqueda
        </h1>
        <p className="text-sm text-neutro-text-muted">
          Definí zonas alrededor de Rosario (radio {SEARCH_AREA_RADIUS_MIN_KM}–
          {SEARCH_AREA_RADIUS_MAX_KM} km) para reutilizarlas al buscar
          Comercios.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-neutro-text">Guardadas</h2>
          <ul className="flex flex-col gap-2" data-admin-areas-list>
            {state.areas.map((area) => {
              const selected = state.selectedAreaId === area.id;
              return (
                <li key={area.id}>
                  <button
                    type="button"
                    data-admin-area-id={area.id}
                    aria-pressed={selected}
                    className={[
                      "flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left text-sm transition-[transform,opacity] duration-150 ease-[var(--ease-out)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
                      selected
                        ? "bg-neutro-surface text-neutro-text"
                        : "bg-neutro-bg text-neutro-text-muted [@media(hover:hover)]:hover:opacity-90",
                    ].join(" ")}
                    onClick={() =>
                      dispatch({ type: "selectArea", id: area.id })
                    }
                  >
                    <span className="font-medium text-neutro-text">
                      {area.name}
                    </span>
                    <span className="text-xs text-neutro-text-muted">
                      {area.center.lat.toFixed(4)}, {area.center.lng.toFixed(4)}{" "}
                      · {area.radiusKm} km ·{" "}
                      {area.shape === "circle" ? "círculo" : "polígono"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="self-start rounded-md bg-neutro-surface px-3 py-2 text-sm text-neutro-text transition-[transform,opacity] duration-150 ease-[var(--ease-out)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 [@media(hover:hover)]:hover:opacity-90"
            onClick={() => dispatch({ type: "resetDraft" })}
          >
            Nueva desde Rosario · 3 km
          </button>
        </div>

        <form
          className="flex flex-col gap-4 rounded-md bg-neutro-surface p-4"
          data-admin-area-form
          onSubmit={onSubmit}
        >
          <h2 className="text-sm font-medium text-neutro-text">
            {state.selectedAreaId
              ? "Reutilizar / editar borrador"
              : "Crear área"}
          </h2>
          <Field label="Nombre">
            <input
              className={inputClass}
              value={state.draft.name}
              onChange={(event) =>
                dispatch({ type: "draftName", name: event.target.value })
              }
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Centro lat">
              <input
                className={inputClass}
                value={state.draft.centerLat}
                onChange={(event) =>
                  dispatch({
                    type: "draftCenterLat",
                    centerLat: event.target.value,
                  })
                }
                inputMode="decimal"
                required
              />
            </Field>
            <Field label="Centro lng">
              <input
                className={inputClass}
                value={state.draft.centerLng}
                onChange={(event) =>
                  dispatch({
                    type: "draftCenterLng",
                    centerLng: event.target.value,
                  })
                }
                inputMode="decimal"
                required
              />
            </Field>
          </div>
          <Field
            label={`Radio (km, ${SEARCH_AREA_RADIUS_MIN_KM}–${SEARCH_AREA_RADIUS_MAX_KM})`}
          >
            <input
              className={inputClass}
              value={state.draft.radiusKm}
              onChange={(event) =>
                dispatch({
                  type: "draftRadiusKm",
                  radiusKm: event.target.value,
                })
              }
              inputMode="decimal"
              required
            />
          </Field>
          <Field label="Forma">
            <select
              className={inputClass}
              value={state.draft.shape}
              onChange={(event) =>
                dispatch({
                  type: "draftShape",
                  shape:
                    event.target.value === "polygon" ? "polygon" : "circle",
                })
              }
            >
              <option value="circle">Círculo</option>
              <option value="polygon">Polígono</option>
            </select>
          </Field>
          {state.draft.shape === "polygon" ? (
            <Field label="Polígono JSON">
              <textarea
                className={`${inputClass} min-h-28 font-mono text-xs`}
                value={state.draft.polygonText}
                onChange={(event) =>
                  dispatch({
                    type: "draftPolygonText",
                    polygonText: event.target.value,
                  })
                }
                spellCheck={false}
              />
            </Field>
          ) : null}
          {message ? (
            <p className="text-sm text-neutro-accent-orange" role="alert">
              {message}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-neutro-accent-orange px-3 py-2 text-sm font-medium text-neutro-on-orange transition-[transform,opacity] duration-150 ease-[var(--ease-out)] active:scale-[0.97] disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100 [@media(hover:hover)]:hover:opacity-90"
          >
            {saving ? "Guardando…" : "Guardar Área de búsqueda"}
          </button>
        </form>
      </div>
    </section>
  );
}
