import type { Comercio } from "@/comercio";
import type { Lead, LeadRepository } from "@/leads/lead";

export type LeadsClient = {
  list(): Promise<Lead[]>;
  save(comercios: Comercio[]): Promise<Lead[]>;
};

export function createRepoLeadsClient(repository: LeadRepository): LeadsClient {
  return {
    list: () => repository.list(),
    save: (comercios) => repository.saveFromComercios(comercios),
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
