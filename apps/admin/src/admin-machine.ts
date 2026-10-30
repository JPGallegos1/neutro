export const ADMIN_SECTIONS = ["comercios", "leads", "areas"] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

export type AdminState = {
  section: AdminSection;
  accessLabel: string;
};

export type AdminEvent =
  | { type: "navigate"; section: AdminSection }
  | { type: "setAccessLabel"; label: string };

export const ADMIN_INITIAL_STATE: AdminState = {
  section: "comercios",
  accessLabel: "Cloudflare Access",
};

export function adminReducer(
  state: AdminState,
  event: AdminEvent,
): AdminState {
  switch (event.type) {
    case "navigate":
      if (state.section === event.section) return state;
      return { ...state, section: event.section };
    case "setAccessLabel":
      if (state.accessLabel === event.label) return state;
      return { ...state, accessLabel: event.label };
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
