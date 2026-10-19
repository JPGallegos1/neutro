import { Schema } from "effect";

export const SiteMetadata = Schema.Struct({
  name: Schema.NonEmptyString,
  title: Schema.NonEmptyString,
  description: Schema.NonEmptyString,
  language: Schema.Literal("es"),
});

export type SiteMetadata = typeof SiteMetadata.Type;

// Keep validation in Effect's typed error channel until the application boundary.
export const decodeSiteMetadata = Schema.decodeUnknownEffect(SiteMetadata);
