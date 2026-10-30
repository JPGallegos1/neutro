import type { Comercio } from "@/comercio";
import {
  areaToDraft,
  createRosarioDefaultDraft,
  type SearchArea,
  type SearchAreaDraft,
  type SearchAreaShape,
  type SearchAreaValidationError,
} from "@/search-area";

export const ADMIN_SECTIONS = ["comercios", "leads", "areas"] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number];
export type AreasStatus = "idle" | "ready" | "saving" | "error";
export type ComerciosStatus = "idle" | "ready" | "searching" | "error";

export type AdminState = {
  section: AdminSection;
  accessLabel: string;
  areas: SearchArea[];
  areasRevision: number;
  areasStatus: AreasStatus;
  areasError: SearchAreaValidationError | "persist_failed" | null;
  selectedAreaId: string | null;
  draft: SearchAreaDraft;
  comercios: Comercio[];
  comerciosRevision: number;
  comerciosStatus: ComerciosStatus;
  selectedComercioKey: string | null;
  leadKeys: ReadonlySet<string>;
};

export type AdminEvent =
  | { type: "navigate"; section: AdminSection }
  | { type: "setAccessLabel"; label: string }
  | { type: "areasHydrated"; areas: SearchArea[]; revision: number }
  | { type: "selectArea"; id: string }
  | { type: "resetDraft" }
  | { type: "draftName"; name: string }
  | { type: "draftCenterLat"; centerLat: string }
  | { type: "draftCenterLng"; centerLng: string }
  | { type: "draftRadiusKm"; radiusKm: string }
  | { type: "draftShape"; shape: SearchAreaShape }
  | { type: "draftPolygonText"; polygonText: string }
  | { type: "saveAreaRequested" }
  | { type: "saveAreaSucceeded"; area: SearchArea; revision: number }
  | {
      type: "saveAreaFailed";
      error: SearchAreaValidationError | "persist_failed";
    }
  | {
      type: "comerciosHydrated";
      comercios: Comercio[];
      revision: number;
    }
  | { type: "selectComercio"; key: string }
  | { type: "comerciosSearchRequested" }
  | {
      type: "comerciosSearchSucceeded";
      comercios: Comercio[];
      revision: number;
    }
  | { type: "comerciosSearchFailed" };

export const ADMIN_INITIAL_STATE: AdminState = {
  section: "comercios",
  accessLabel: "Cloudflare Access",
  areas: [],
  areasRevision: 0,
  areasStatus: "idle",
  areasError: null,
  selectedAreaId: null,
  draft: createRosarioDefaultDraft(),
  comercios: [],
  comerciosRevision: 0,
  comerciosStatus: "idle",
  selectedComercioKey: null,
  leadKeys: new Set(),
};

export function adminReducer(state: AdminState, event: AdminEvent): AdminState {
  switch (event.type) {
    case "navigate":
      return state.section === event.section
        ? state
        : { ...state, section: event.section };
    case "setAccessLabel":
      return state.accessLabel === event.label
        ? state
        : { ...state, accessLabel: event.label };
    case "areasHydrated":
      if (
        state.areasRevision === event.revision &&
        state.areasStatus === "ready"
      ) {
        return state;
      }
      return {
        ...state,
        areas: event.areas,
        areasRevision: event.revision,
        areasStatus: "ready",
        areasError: null,
        selectedAreaId:
          state.selectedAreaId &&
          event.areas.some((a) => a.id === state.selectedAreaId)
            ? state.selectedAreaId
            : (event.areas[0]?.id ?? null),
      };
    case "selectArea": {
      const area = state.areas.find((item) => item.id === event.id);
      if (!area) return state;
      return {
        ...state,
        selectedAreaId: area.id,
        draft: areaToDraft(area),
        areasError: null,
      };
    }
    case "resetDraft":
      return {
        ...state,
        selectedAreaId: null,
        draft: createRosarioDefaultDraft(),
        areasError: null,
      };
    case "draftName":
      return { ...state, draft: { ...state.draft, name: event.name } };
    case "draftCenterLat":
      return {
        ...state,
        draft: { ...state.draft, centerLat: event.centerLat },
      };
    case "draftCenterLng":
      return {
        ...state,
        draft: { ...state.draft, centerLng: event.centerLng },
      };
    case "draftRadiusKm":
      return { ...state, draft: { ...state.draft, radiusKm: event.radiusKm } };
    case "draftShape":
      return { ...state, draft: { ...state.draft, shape: event.shape } };
    case "draftPolygonText":
      return {
        ...state,
        draft: { ...state.draft, polygonText: event.polygonText },
      };
    case "saveAreaRequested":
      return { ...state, areasStatus: "saving", areasError: null };
    case "saveAreaSucceeded": {
      const exists = state.areas.some((a) => a.id === event.area.id);
      const areas = exists
        ? state.areas.map((a) => (a.id === event.area.id ? event.area : a))
        : [...state.areas, event.area];
      return {
        ...state,
        areas,
        areasRevision: event.revision,
        areasStatus: "ready",
        areasError: null,
        selectedAreaId: event.area.id,
        draft: areaToDraft(event.area),
      };
    }
    case "saveAreaFailed":
      return { ...state, areasStatus: "ready", areasError: event.error };
    case "comerciosHydrated":
      if (state.comerciosStatus === "searching") {
        return state;
      }
      if (
        state.comerciosStatus === "ready" &&
        state.comerciosRevision !== event.revision
      ) {
        return state;
      }
      if (
        state.comerciosRevision === event.revision &&
        state.comerciosStatus === "ready"
      ) {
        return state;
      }
      return {
        ...state,
        comercios: event.comercios,
        comerciosRevision: event.revision,
        comerciosStatus: "ready",
        selectedComercioKey:
          state.selectedComercioKey &&
          event.comercios.some(
            (c) => `${c.source}:${c.externalId}` === state.selectedComercioKey,
          )
            ? state.selectedComercioKey
            : event.comercios[0]
              ? `${event.comercios[0].source}:${event.comercios[0].externalId}`
              : null,
      };
    case "selectComercio":
      return { ...state, selectedComercioKey: event.key };
    case "comerciosSearchRequested":
      return { ...state, comerciosStatus: "searching" };
    case "comerciosSearchSucceeded":
      return {
        ...state,
        comercios: event.comercios,
        comerciosRevision: event.revision,
        comerciosStatus: "ready",
        selectedComercioKey: event.comercios[0]
          ? `${event.comercios[0].source}:${event.comercios[0].externalId}`
          : null,
      };
    case "comerciosSearchFailed":
      return { ...state, comerciosStatus: "error" };
  }
}

export function sectionFromPathname(pathname: string): AdminSection {
  const segment = pathname.replace(/^\//, "").split("/")[0] ?? "";
  if (segment === "leads") return "leads";
  if (segment === "areas") return "areas";
  return "comercios";
}

export function pathForSection(section: AdminSection): string {
  return `/${section}`;
}
