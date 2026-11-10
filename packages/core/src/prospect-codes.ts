export const PROSPECT_LANDING_ORIGIN = "https://neutro.solutions";

export const PROSPECT_UTM = {
  source: "whatsapp",
  medium: "outbound",
  campaign: "prospeccion-2026-11-10",
  testCampaign: "prueba-prospeccion",
} as const;

export type ProspectCodeEntry = {
  source?: string;
  medium?: string;
  campaign?: string;
};

export const PROSPECT_CODES = {
  t001: {},
  t002: {},
  t003: {},
  t004: {},
  t005: {},
  wapp: { source: "whatsapp" },
  inst: { source: "instagram" },
  face: { source: "facebook" },
  form: { source: "web" },
} as const satisfies Record<string, ProspectCodeEntry>;

export type ProspectCode = keyof typeof PROSPECT_CODES;

export function isProspectCode(value: string): value is ProspectCode {
  return Object.hasOwn(PROSPECT_CODES, value);
}

export function resolveProspectUtm(code: ProspectCode): {
  source: string;
  medium: string;
  campaign: string;
} {
  const entry = PROSPECT_CODES[code] as ProspectCodeEntry;
  const isTest = code.startsWith("t");
  return {
    source: entry.source ?? PROSPECT_UTM.source,
    medium: entry.medium ?? PROSPECT_UTM.medium,
    campaign:
      entry.campaign ??
      (isTest ? PROSPECT_UTM.testCampaign : PROSPECT_UTM.campaign),
  };
}
