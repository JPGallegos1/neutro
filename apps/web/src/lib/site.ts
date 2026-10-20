import { decodeSiteMetadata } from "@neutro/core/site";
import { Effect } from "effect";

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
