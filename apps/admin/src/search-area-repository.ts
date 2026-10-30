import type { CreateSearchAreaInput, SearchArea } from "@/search-area";

export type SearchAreaRepository = {
  list(): Promise<SearchArea[]>;
  create(input: CreateSearchAreaInput): Promise<SearchArea>;
  getById(id: string): Promise<SearchArea | null>;
};
