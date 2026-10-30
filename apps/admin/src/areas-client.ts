import type {
  CreateSearchAreaInput,
  SearchArea,
  SearchAreaRepository,
} from "@/search-area";

export type AreasClient = {
  list(): Promise<SearchArea[]>;
  create(input: CreateSearchAreaInput): Promise<SearchArea>;
};

export function createRepoAreasClient(
  repository: SearchAreaRepository,
): AreasClient {
  return { list: () => repository.list(), create: (i) => repository.create(i) };
}

export function createHttpAreasClient(baseUrl = ""): AreasClient {
  return {
    async list() {
      const res = await fetch(`${baseUrl}/api/areas`);
      if (!res.ok) throw new Error(`list_failed_${res.status}`);
      return ((await res.json()) as { areas: SearchArea[] }).areas;
    },
    async create(input) {
      const res = await fetch(`${baseUrl}/api/areas`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`create_failed_${res.status}`);
      return ((await res.json()) as { area: SearchArea }).area;
    },
  };
}

let active: AreasClient | null = null;
export const setAreasClient = (c: AreasClient) => {
  active = c;
};
export const getAreasClient = () => {
  if (!active) throw new Error("areas_client_missing");
  return active;
};
