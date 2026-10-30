import {
  comercioKey,
  type Comercio,
  type ComercioSource,
  type NeutroRubro,
} from "@/comercio";

export const LEAD_STATUSES = [
  "nuevo",
  "contactado",
  "interesado",
  "descartado",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const INITIAL_LEAD_STATUS: LeadStatus = "nuevo";

export type Lead = {
  id: string;
  source: ComercioSource;
  externalId: string;
  name: string;
  lat: number;
  lng: number;
  website: string | null;
  address: string | null;
  socialUrls: string[];
  rubro: NeutroRubro;
  attribution: string;
  status: LeadStatus;
  notes: string;
  assignee: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeadStatusFilter = LeadStatus | "todos";

export type LeadUpdatePatch = {
  status?: LeadStatus;
  notes?: string;
  assignee?: string | null;
};

export type LeadRepository = {
  list(): Promise<Lead[]>;
  saveFromComercios(comercios: Comercio[]): Promise<Lead[]>;
  update(id: string, patch: LeadUpdatePatch): Promise<Lead>;
};

export function leadKey(lead: Pick<Lead, "source" | "externalId">): string {
  return `${lead.source}:${lead.externalId}`;
}

export function createLeadFromComercio(
  comercio: Comercio,
  options?: {
    id?: string;
    now?: string;
    status?: LeadStatus;
    notes?: string;
    assignee?: string | null;
  },
): Lead {
  const now = options?.now ?? new Date().toISOString();
  return {
    id: options?.id ?? `lead_${comercio.source}_${comercio.externalId}`,
    source: comercio.source,
    externalId: comercio.externalId,
    name: comercio.name,
    lat: comercio.lat,
    lng: comercio.lng,
    website: comercio.website,
    address: comercio.address,
    socialUrls: [...comercio.socialUrls],
    rubro: comercio.rubro,
    attribution: comercio.attribution,
    status: options?.status ?? INITIAL_LEAD_STATUS,
    notes: options?.notes ?? "",
    assignee: options?.assignee ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function mergeLeadsByIdentity(
  existing: Lead[],
  incoming: Lead[],
): Lead[] {
  const map = new Map<string, Lead>();
  for (const lead of existing) map.set(leadKey(lead), lead);
  for (const lead of incoming) {
    const key = leadKey(lead);
    if (!map.has(key)) map.set(key, lead);
  }
  return [...map.values()];
}

export function saveSelectionAsLeads(
  selection: Comercio[],
  existing: Lead[],
  now?: string,
): { all: Lead[]; created: Lead[]; reused: Lead[] } {
  const byKey = new Map(existing.map((lead) => [leadKey(lead), lead]));
  const created: Lead[] = [];
  const reused: Lead[] = [];
  const seen = new Set<string>();
  for (const comercio of selection) {
    const key = comercioKey(comercio);
    if (seen.has(key)) continue;
    seen.add(key);
    const found = byKey.get(key);
    if (found) {
      reused.push(found);
      continue;
    }
    const lead = createLeadFromComercio(
      comercio,
      now === undefined ? undefined : { now },
    );
    byKey.set(key, lead);
    created.push(lead);
  }
  return { all: [...byKey.values()], created, reused };
}

export function filterLeadsByStatus(leads: Lead[], filter: LeadStatusFilter) {
  return filter === "todos" ? [...leads] : leads.filter((l) => l.status === filter);
}

export function updateLeadFields(
  lead: Lead,
  patch: LeadUpdatePatch,
  now?: string,
): Lead {
  return {
    ...lead,
    status: patch.status ?? lead.status,
    notes: patch.notes !== undefined ? patch.notes : lead.notes,
    assignee: patch.assignee !== undefined ? patch.assignee : lead.assignee,
    updatedAt: now ?? new Date().toISOString(),
  };
}

export function leadMapsUrl(lead: Pick<Lead, "lat" | "lng">) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lead.lat},${lead.lng}`)}`;
}

export function leadWhatsAppUrl(lead: Pick<Lead, "name">) {
  return `https://wa.me/?text=${encodeURIComponent(`Hola, te contacto por ${lead.name}`)}`;
}

export function createMemoryLeadRepository(options?: {
  seed?: Lead[];
  now?: string;
}): LeadRepository {
  const byId = new Map((options?.seed ?? []).map((l) => [l.id, l] as const));
  return {
    async list() {
      return [...byId.values()];
    },
    async saveFromComercios(comercios) {
      const result = saveSelectionAsLeads(
        comercios,
        [...byId.values()],
        options?.now,
      );
      for (const lead of result.created) byId.set(lead.id, lead);
      return [...result.created, ...result.reused];
    },
    async update(id, patch) {
      const current = byId.get(id);
      if (!current) throw new Error("lead_not_found");
      const next = updateLeadFields(current, patch, options?.now);
      byId.set(id, next);
      return next;
    },
  };
}
