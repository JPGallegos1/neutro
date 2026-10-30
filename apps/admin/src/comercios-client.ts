import type { Comercio } from "@/comercio";
import { searchComerciosFromFixtures } from "@/comercio";

export type ComerciosSearchQuery = {
  lat: number;
  lng: number;
  radiusKm: number;
};

export type ComerciosClient = {
  search(query: ComerciosSearchQuery): Promise<Comercio[]>;
};

export function createFixtureComerciosClient(): ComerciosClient {
  return {
    async search() {
      return searchComerciosFromFixtures();
    },
  };
}

export function createHttpComerciosClient(baseUrl = ""): ComerciosClient {
  return {
    async search(query) {
      const qs = new URLSearchParams({
        lat: String(query.lat),
        lng: String(query.lng),
        radiusKm: String(query.radiusKm),
      });
      const res = await fetch(`${baseUrl}/api/comercios?${qs}`);
      if (!res.ok) throw new Error(`comercios_failed_${res.status}`);
      return ((await res.json()) as { comercios: Comercio[] }).comercios;
    },
  };
}

let active: ComerciosClient | null = null;
export const setComerciosClient = (c: ComerciosClient) => {
  active = c;
};
export const getComerciosClient = () => {
  if (!active) throw new Error("comercios_client_missing");
  return active;
};
