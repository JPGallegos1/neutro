export type ServiceItem = {
  label: string;
  benefit: string;
};

export type ServiceCategory = {
  id: string;
  title: string;
  summary: string | null;
  services: ServiceItem[];
  defaultOpen?: boolean;
};

/**
 * Contenido del acordeón según v29. Solo «Web» trae cuerpo completo en el .pen;
 * el resto tiene título y panel vacío hasta que llegue el copy.
 */
export const serviceCategories: ServiceCategory[] = [
  {
    id: "web",
    title: "Web",
    defaultOpen: true,
    summary:
      "Tu negocio presentado con claridad, para que te elijan antes de preguntar.",
    services: [
      {
        label: "SITIO PARA TU NEGOCIO",
        benefit: "Una web clara que cuenta qué hacés y genera confianza.",
      },
      {
        label: "RESERVAS Y TURNOS",
        benefit: "Tus clientes agendan solos, sin idas y vueltas por chat.",
      },
      {
        label: "REDISEÑO",
        benefit: "Tu web vieja, renovada y fácil de actualizar.",
      },
      {
        label: "MEDICIÓN Y ANALÍTICA",
        benefit: "Sabé qué páginas venden y de dónde llegan tus clientes.",
      },
    ],
  },
  {
    id: "diseno",
    title: "Diseño",
    summary: null,
    services: [],
  },
  {
    id: "sistemas",
    title: "Sistemas",
    summary: null,
    services: [],
  },
  {
    id: "tienda-online",
    title: "Tienda online",
    summary: null,
    services: [],
  },
  {
    id: "automatizacion-ia",
    title: "Automatización con IA",
    summary: null,
    services: [],
  },
];
