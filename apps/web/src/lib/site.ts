import { decodeSiteMetadata } from "@neutro/core/site";
import { Effect } from "effect";

// Execute only at the Astro build boundary; invalid metadata fails the build.
export const site = Effect.runSync(
  decodeSiteMetadata({
    name: "Neutro",
    title: "Neutro — Producto digital, sin ruido",
    description:
      "Diseñamos y construimos producto digital con criterio. Interfaces claras, sistemas sólidos y menos teatro. Estudio en Argentina.",
    language: "es",
    locale: "es_AR",
    url: "https://neutro.solutions/",
    email: "hola@neutro.solutions",
  }),
);
