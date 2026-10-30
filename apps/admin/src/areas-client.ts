import type { CreateSearchAreaInput, SearchArea } from "@/search-area";
import type { SearchAreaRepository } from "@/search-area-repository";

export type AreasClient = {
  list(): Promise<SearchArea[]>;
  create(input: CreateSearchAreaInput): Promise<SearchArea>;
};

export function createRepoAreasClient(
  repository: SearchAreaRepository,
): AreasClient {
  return {
    list: () => repository.list(),
    create: (input) => repository.create(input),
  };
}

export function createHttpAreasClient(baseUrl = ""): AreasClient {
  return {
    async list() {
      const response = await fetch(`${baseUrl}/api/areas`);
      if (!response.ok) {
        throw new Error(`list_failed_${response.status}`);
      }
      const body = (await response.json()) as { areas: SearchArea[] };
      return body.areas;
    },
    async create(input) {
      const response = await fetch(`${baseUrl}/api/areas`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        throw new Error(`create_failed_${response.status}`);
      }
      const body = (await response.json()) as { area: SearchArea };
      return body.area;
    },
  };
}

let activeClient: AreasClient | null = null;

export function setAreasClient(client: AreasClient) {
  activeClient = client;
}

export function getAreasClient(): AreasClient {
  if (activeClient) return activeClient;
  if (import.meta.env.MODE === "test") {
    throw new Error("areas_client_missing_in_test");
  }
  activeClient = createHttpAreasClient();
  return activeClient;
}
