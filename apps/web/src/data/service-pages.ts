import { workProjects, type WorkProject } from "./work.ts";

export const SHOW_WEB_SITIO_PRESUPUESTO_LINE = false;
export const SHOW_WEB_TURNOS_SUMAR_A_WEB_ACTUAL_LINE = false;

export const WEB_SITIO_PRESUPUESTO_LINE =
  "El presupuesto depende de lo que tiene que hacer tu web; escribinos y te lo armamos.";

export const WEB_TURNOS_SUMAR_A_WEB_ACTUAL_LINE =
  "También se pueden sumar a la web que ya tenés.";

const SITE = "https://neutro.solutions";

export type ServiceRelatedLink = {
  href: string;
  label: string;
};

export type ServiceBlock = {
  id: string;
  title: string;
  paragraphs: readonly string[];
};

export type ServicePageCopy = {
  path: string;
  crumb: string;
  title: string;
  description: string;
  heading: string;
  lead: string;
  serviceName: string;
  casesTitle: string | null;
  caseSlugs: readonly string[];
  blocks: readonly ServiceBlock[];
  related: readonly ServiceRelatedLink[];
  closing: string;
  ctaLabel: string;
};

export const servicePages = {
  web: {
    path: "/web",
    crumb: "Web",
    title: "Diseño web en Rosario para negocios | Neutro Solutions",
    description:
      "Hacemos webs claras para negocios de Rosario y todo el país: sitio, turnos online, rediseño y medición. Ves el diseño antes de que lo construyamos.",
    heading: "Diseño web en Rosario para que te elijan antes de preguntar",
    lead: "Hacemos webs claras para negocios de Rosario y de todo el país: cuentan qué hacés, generan confianza y te muestran de dónde llegan tus clientes.",
    serviceName: "Web",
    casesTitle: "Webs que ya están funcionando",
    caseSlugs: [
      "afectiva",
      "capa-automotores",
      "suplementacion-ciencia",
      "conexion-laboral",
      "luxurycars",
    ],
    blocks: [
      {
        id: "sitio",
        title: "Sitio para tu negocio",
        paragraphs: [
          "Una web que explica en pocos segundos qué hacés, para quién y cómo contactarte, y que se lee bien en el celular.",
        ],
      },
      {
        id: "turnos",
        title: "Reservas y turnos online",
        paragraphs: [
          "Tus clientes eligen día y horario solos, sin idas y vueltas por chat. Vos ves la agenda ordenada y recibís el aviso de cada turno.",
        ],
      },
      {
        id: "rediseno",
        title: "Rediseño de tu web actual",
        paragraphs: [
          "Si tu web quedó vieja o es difícil de actualizar, la renovamos y te queda fácil de editar.",
        ],
      },
      {
        id: "medicion",
        title: "Medición y analítica",
        paragraphs: [
          "Sabés qué páginas te traen consultas y de dónde llegan tus clientes, para decidir con datos y no a ojo.",
        ],
      },
    ],
    related: [{ href: "/automatizacion-ia", label: "Automatización con IA" }],
    closing:
      "Si querés una web clara para tu negocio, escribinos y lo vemos juntos.",
    ctaLabel: "Escribinos",
  },
  automatizacionIa: {
    path: "/automatizacion-ia",
    crumb: "Automatización con IA",
    title: "Automatización con IA y bots de WhatsApp | Neutro Solutions",
    description:
      "Automatizamos lo que hoy hacés a mano: asistente de IA en WhatsApp, recordatorios, tareas repetitivas e integraciones entre tus herramientas.",
    heading: "Automatización con IA para que lo que hacés a mano funcione solo",
    lead: "Respondemos consultas, mandamos recordatorios y conectamos tus herramientas para que tu equipo deje de repetir las mismas tareas todos los días.",
    serviceName: "Automatización con IA",
    casesTitle: null,
    caseSlugs: [],
    blocks: [
      {
        id: "asistente",
        title: "Asistente de IA en WhatsApp y en tu web",
        paragraphs: [
          "Un bot de WhatsApp que responde las consultas de siempre (horarios, precios, disponibilidad) aunque estés ocupado, y te pasa la conversación cuando hace falta una persona.",
        ],
      },
      {
        id: "recordatorios",
        title: "Recordatorios y seguimiento automáticos",
        paragraphs: [
          "Avisos de turnos, pedidos y pagos pendientes que salen solos, sin que tengas que escribir cada mensaje.",
        ],
      },
      {
        id: "procesos",
        title: "Automatización de procesos",
        paragraphs: [
          "Lo que repetís todos los días (cargar datos, pasar información de un lado a otro, armar reportes) funcionando solo.",
        ],
      },
      {
        id: "integraciones",
        title: "Integraciones entre tus herramientas",
        paragraphs: [
          "Conectamos tus sistemas para que los datos pasen solos, sin copiar y pegar.",
        ],
      },
    ],
    related: [{ href: "/web", label: "Web" }],
    closing:
      "Si querés automatizar una tarea que hoy te come tiempo, escribinos.",
    ctaLabel: "Escribinos",
  },
} as const satisfies Record<string, ServicePageCopy>;

export type ServicePageKey = keyof typeof servicePages;

export function serviceContactHref(path: string): string {
  return `/contacto?origen=${path}`;
}

export function servicePageCases(
  page: ServicePageCopy,
  projects: readonly WorkProject[] = workProjects,
): WorkProject[] {
  const bySlug = new Map(projects.map((project) => [project.slug, project]));
  return page.caseSlugs.map((slug) => {
    const project = bySlug.get(slug);
    if (!project) {
      throw new Error(`Falta el caso de trabajo ${slug} para ${page.path}`);
    }
    return project;
  });
}

export function servicePageJsonLd(page: ServicePageCopy) {
  const url = `${SITE}${page.path}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: page.serviceName,
        description: page.description,
        url,
        provider: {
          "@type": "Organization",
          name: "Neutro Solutions",
          url: `${SITE}/`,
        },
        areaServed: [
          {
            "@type": "Country",
            name: "Argentina",
          },
          {
            "@type": "City",
            name: "Rosario",
          },
        ],
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Servicios",
            item: `${SITE}/#que-hacemos`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: page.crumb,
            item: url,
          },
        ],
      },
    ],
  };
}
