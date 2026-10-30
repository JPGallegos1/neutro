import type { Comercio } from "@/comercio";
import type { Lead, LeadRepository, LeadUpdatePatch } from "@/leads/lead";

export type LeadsClient = {
  list(): Promise<Lead[]>;
  save(comercios: Comercio[]): Promise<Lead[]>;
  update(id: string, patch: LeadUpdatePatch): Promise<Lead>;
};

export function createRepoLeadsClient(repository: LeadRepository): LeadsClient {
  return {
    list: () => repository.list(),
    save: (comercios) => repository.saveFromComercios(comercios),
    update: (id, patch) => repository.update(id, patch),
  };
}

export function createHttpLeadsClient(baseUrl = ""): LeadsClient {
  return {
    async list() {
      const res = await fetch(`${baseUrl}/api/leads`);
      if (!res.ok) throw new Error(`leads_list_failed_${res.status}`);
      return ((await res.json()) as { leads: Lead[] }).leads;
    },
    async save(comercios) {
      const res = await fetch(`${baseUrl}/api/leads`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ comercios }),
      });
      if (!res.ok) throw new Error(`leads_save_failed_${res.status}`);
      return ((await res.json()) as { leads: Lead[] }).leads;
    },
    async update(id, patch) {
      const res = await fetch(`${baseUrl}/api/leads/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`leads_update_failed_${res.status}`);
      return ((await res.json()) as { lead: Lead }).lead;
    },
  };
}

export type AccessMeClient = {
  me(): Promise<{ email: string | null }>;
};

export function createHttpAccessMeClient(baseUrl = ""): AccessMeClient {
  return {
    async me() {
      const res = await fetch(`${baseUrl}/api/me`);
      if (!res.ok) throw new Error(`access_me_failed_${res.status}`);
      return (await res.json()) as { email: string | null };
    },
  };
}

export function createStaticAccessMeClient(
  email: string | null,
): AccessMeClient {
  return {
    async me() {
      return { email };
    },
  };
}

let active: LeadsClient | null = null;
export const setLeadsClient = (c: LeadsClient) => {
  active = c;
};
export const getLeadsClient = () => {
  if (!active) throw new Error("leads_client_missing");
  return active;
};

let accessMe: AccessMeClient | null = null;
export const setAccessMeClient = (c: AccessMeClient) => {
  accessMe = c;
};
export const getAccessMeClient = () => {
  if (!accessMe) throw new Error("access_me_client_missing");
  return accessMe;
};
