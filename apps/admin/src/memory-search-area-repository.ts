import {
  createRosarioDefaultArea,
  createSearchArea,
  type CreateSearchAreaInput,
  type SearchArea,
} from "@/search-area";
import type { SearchAreaRepository } from "@/search-area-repository";

export function createMemorySearchAreaRepository(options?: {
  seedRosario?: boolean;
  now?: string;
}): SearchAreaRepository {
  const areas = new Map<string, SearchArea>();
  if (options?.seedRosario !== false) {
    const seed = createRosarioDefaultArea(options?.now);
    areas.set(seed.id, seed);
  }

  return {
    async list() {
      return [...areas.values()].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      );
    },
    async create(input: CreateSearchAreaInput) {
      const result = createSearchArea(input);
      if (!result.ok) {
        throw new Error(result.error);
      }
      areas.set(result.value.id, result.value);
      return result.value;
    },
    async getById(id: string) {
      return areas.get(id) ?? null;
    },
  };
}
