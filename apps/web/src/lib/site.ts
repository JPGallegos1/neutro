import { decodeSiteMetadata } from "@neutro/core/site";
import { Effect } from "effect";

export const site = Effect.runSync(
  decodeSiteMetadata({
    name: "Neutro",
    title: "Neutro — Under construction",
    description: "Estamos construyendo Neutro. Pronto, una nueva experiencia.",
    language: "es",
  }),
);
