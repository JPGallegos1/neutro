type PageMeta = {
  path: string;
  canonical: string;
  title: string;
  description: string;
  heading: string;
};

const origin = "https://neutro.solutions";

function page(
  path: string,
  title: string,
  description: string,
  heading: string,
): PageMeta {
  const canonical = path === "/" ? `${origin}/` : `${origin}${path}`;
  return { path, canonical, title, description, heading };
}

export const pageMeta = {
  home: page(
    "/",
    "Neutro Solutions | Webs, sistemas y automatización con IA",
    "Webs, tiendas online, sistemas y automatización con IA para tu negocio. Ordenamos lo que hoy hacés a mano para que vendas más y trabajes menos. Escribinos.",
    "Empezá a crear el sistema que te diferencia",
  ),
  nosotros: page(
    "/nosotros",
    "Nosotros | Neutro Solutions",
    "Somos Neutro Solutions: diseñamos webs, tiendas y sistemas para tu negocio. Definimos con vos qué necesitás antes de construir y medimos para decidir mejor.",
    "Quiénes somos y cómo trabajamos",
  ),
  cookies: page(
    "/cookies",
    "Política de cookies | Neutro Solutions",
    "Qué guarda neutro.solutions en tu navegador. No usamos cookies ni banners. Medimos sin cookies, descartamos tu IP y sólo guardamos tu preferencia de tema.",
    "Política de cookies",
  ),
  privacidad: page(
    "/privacidad",
    "Política de privacidad | Neutro Solutions",
    "Qué datos tuyos tratamos cuando nos escribís, para qué los usamos, cuánto tiempo los guardamos y cómo podés pedir acceso, corrección o que los borremos.",
    "Política de privacidad",
  ),
  terminos: page(
    "/terminos",
    "Términos y condiciones | Neutro Solutions",
    "Las reglas para usar neutro.solutions: qué podés esperar del sitio, qué te pedimos a vos, tus derechos como consumidor y cómo hacer un reclamo si lo necesitás.",
    "Términos y condiciones",
  ),
  alertaEstafa: page(
    "/alerta-estafa",
    "Alerta de estafa | Neutro Solutions",
    "¿Te escribieron en nombre de Neutro Solutions? Te contamos cuáles son nuestros únicos canales oficiales, cómo detectar una suplantación y dónde denunciarla.",
    "Alerta de estafa: cómo reconocer nuestros canales oficiales",
  ),
} as const;

export const organizationLogoPath = "/images/neutro/ns-icono-c-positivo.png";

const organization = {
  "@type": "Organization",
  "@id": `${origin}/#organization`,
  name: "Neutro Solutions",
  url: `${origin}/`,
  email: "hola@neutro.solutions",
  logo: {
    "@type": "ImageObject",
    url: `${origin}${organizationLogoPath}`,
  },
  sameAs: ["https://www.instagram.com/neutro.solutions"],
};

const website = {
  "@type": "WebSite",
  "@id": `${origin}/#website`,
  url: `${origin}/`,
  name: "Neutro Solutions",
  inLanguage: "es-AR",
  publisher: {
    "@id": `${origin}/#organization`,
  },
};

export const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [organization, website],
} as const;
