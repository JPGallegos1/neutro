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
    value: "+54 9 341 3 398-851",
    href: "https://wa.me/5493413398851",
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
  consentBefore: "Acepto la ",
  privacyLabel: "Política de privacidad",
  privacyHref: "/privacidad",
  consentMiddle: " y los ",
  termsLabel: "Términos y condiciones",
  termsHref: "/terminos",
  hint: "Para enviar, aceptá la política de privacidad y los términos.",
  submit: "Enviar",
} as const;
