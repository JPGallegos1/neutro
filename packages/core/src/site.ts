import { Schema } from "effect";

export const SiteMetadata = Schema.Struct({
  name: Schema.NonEmptyString,
  title: Schema.NonEmptyString,
  description: Schema.NonEmptyString,
  language: Schema.Literal("es"),
  locale: Schema.Literal("es_AR"),
  url: Schema.NonEmptyString,
  email: Schema.NonEmptyString,
});

export type SiteMetadata = typeof SiteMetadata.Type;

export const decodeSiteMetadata = Schema.decodeUnknownEffect(SiteMetadata);
