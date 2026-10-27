import { pageMeta } from "@/data/page-meta";
import { decodeSiteMetadata } from "@neutro/core/site";
import { Effect } from "effect";

export const site = Effect.runSync(
  decodeSiteMetadata({
    name: "Neutro Solutions",
    title: pageMeta.home.title,
    description: pageMeta.home.description,
    language: "es",
    locale: "es_AR",
    url: "https://neutro.solutions/",
    email: "hola@neutro.solutions",
  }),
);
