export type ContactoChannel = {
  id: string;
  title: string;
  value: string;
  href?: string;
  blank?: boolean;
  dark?: boolean;
  decorative?: boolean;
};

export const contactoChannels: ContactoChannel[] = [
  {
    id: "heading",
    title: "Canales de comunicación",
    value: "",
  },
  {
    id: "blank-top",
    title: "",
    value: "",
    decorative: true,
    dark: true,
  },
  {
    id: "whatsapp",
    title: "WhatsApp",
    value: "+54 9 341 398851",
    href: "https://wa.me/5493413988851",
    blank: true,
    dark: true,
  },
  {
    id: "instagram",
    title: "Instagram",
    value: "neutro.solutions",
    href: "https://instagram.com/neutro.solutions",
    blank: true,
  },
  {
    id: "email",
    title: "Email",
    value: "hola@neutro.solutions",
    href: "mailto:hola@neutro.solutions",
  },
  {
    id: "linkedin",
    title: "LinkedIn",
    value: "Próximamente",
    dark: true,
  },
  {
    id: "blank-bottom",
    title: "",
    value: "",
    decorative: true,
    dark: true,
  },
  {
    id: "facebook",
    title: "Facebook",
    value: "Próximamente",
  },
];

export const contactoCountries = [
  "Argentina",
  "Uruguay",
  "Chile",
  "México",
  "Colombia",
  "Perú",
  "España",
  "Venezuela",
  "Ecuador",
  "Bolivia",
  "Paraguay",
  "Costa Rica",
  "Panamá",
  "Cuba",
  "República Dominicana",
  "Guatemala",
  "Honduras",
  "El Salvador",
  "Nicaragua",
  "Guinea Ecuatorial",
  "Otro",
] as const;

export const contactoFormCopy = {
  title: "Construyamos algo juntos",
  lines: [
    "Unimos creatividad humana y tecnología elegida para tu negocio.",
    "Cuidamos cada detalle para construir algo que marque la diferencia.",
  ],
  workLinkLabel: "Conocé nuestra forma de trabajar.",
  workLinkHref: "/#nuestra-forma-de-trabajar",
  consentBefore: "Acepto la ",
  privacyLabel: "Política de privacidad",
  privacyHref: "/privacidad",
  consentMiddle: " y los ",
  termsLabel: "Términos y condiciones",
  termsHref: "/terminos",
  hint: "Para enviar, aceptá la política de privacidad y los términos.",
  submit: "Enviar",
} as const;

export const contactoHeroFlags = [
  { file: "argentina.svg", label: "Argentina" },
  { file: "uruguay.svg", label: "Uruguay" },
  { file: "chile.svg", label: "Chile" },
  { file: "mexico.svg", label: "México" },
  { file: "colombia.svg", label: "Colombia" },
  { file: "peru.svg", label: "Perú" },
  { file: "espana.svg", label: "España" },
  { file: "venezuela.svg", label: "Venezuela" },
  { file: "ecuador.svg", label: "Ecuador" },
  { file: "bolivia.svg", label: "Bolivia" },
  { file: "paraguay.svg", label: "Paraguay" },
  { file: "costa-rica.svg", label: "Costa Rica" },
  { file: "panama.svg", label: "Panamá" },
  { file: "cuba.svg", label: "Cuba" },
  { file: "republica-dominicana.svg", label: "República Dominicana" },
  { file: "guatemala.svg", label: "Guatemala" },
  { file: "honduras.svg", label: "Honduras" },
  { file: "el-salvador.svg", label: "El Salvador" },
  { file: "nicaragua.svg", label: "Nicaragua" },
  { file: "guinea-ecuatorial.svg", label: "Guinea Ecuatorial" },
] as const;

export const contactoHeroTiming = {
  colMs: 30,
  holdMs: 1600,
  eraseMs: 18,
  gapMs: 250,
  blinkMs: 500,
} as const;

export const contactoHeroGlyphs: Record<string, string[]> = {
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  o: ["00000", "00000", "01110", "10001", "10001", "10001", "01110"],
  l: ["01100", "00100", "00100", "00100", "00100", "00100", "01110"],
  a: ["00000", "00000", "01110", "00001", "01111", "10001", "01111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  u: ["00000", "00000", "10001", "10001", "10001", "10011", "01101"],
  n: ["00000", "00000", "10110", "11001", "10001", "10001", "10001"],
  d: ["00001", "00001", "01101", "10011", "10001", "10001", "01111"],
  " ": ["000", "000", "000", "000", "000", "000", "000"],
};

export const contactoHeroText = "Hola Mundo";
export const contactoFlagCell = { width: 14, height: 9, gap: 3 } as const;
