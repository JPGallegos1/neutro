import { Schema } from "effect";

export const SiteMetadata = Schema.Struct({
  name: Schema.NonEmptyString,
  title: Schema.NonEmptyString,
  description: Schema.NonEmptyString,
  language: Schema.Literal("es"),
});

export type SiteMetadata = typeof SiteMetadata.Type;

export const decodeSiteMetadata = Schema.decodeUnknownEffect(SiteMetadata);
