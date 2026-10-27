export type WorkProject = {
  id: string;
  slug: string;
  title: string;
  description: string;
  tag: string;
  imageSrc: string;
  imageAlt: string;
  tint: string;
  href: string;
};

export const LANDING_WORK_LIMIT = 4;

export const workProjects: WorkProject[] = [
  {
    id: "conexlaboral",
    slug: "conexion-laboral",
    title: "Conexión Laboral",
    description:
      "Reclutamiento para PyMEs en Argentina: busca, filtra y presenta los 3 mejores candidatos con informe.",
    tag: "En producción",
    imageSrc: "/images/work/conexlaboral.webp",
    imageAlt:
      "Página de inicio de Conexión Laboral con el título 'Cubrí la vacante que necesitás' y dos personas dándose la mano",
    tint: "#2F3F55",
    href: "/trabajo/conexion-laboral",
  },
  {
    id: "afectiva",
    slug: "afectiva",
    title: "Afectiva Comunicaciones",
    description:
      "Agencia de comunicación: estrategia, diseño, contenido y producción para marcas con historia.",
    tag: "En producción",
    imageSrc: "/images/work/afectiva.webp",
    imageAlt:
      "Página de inicio de Afectiva Comunicaciones con el título 'Impulsamos tu marca en el mundo digital' y un sello circular violeta",
    tint: "#342850",
    href: "/trabajo/afectiva",
  },
  {
    id: "capaautomotores",
    slug: "capa-automotores",
    title: "Capa Automotores",
    description:
      "Concesionaria de usados y 0km en Rosario, con financiación hasta 60% y toma de tu usado en parte de pago.",
    tag: "En producción",
    imageSrc: "/images/work/capaautomotores.webp",
    imageAlt:
      "Página de inicio de Capa Automotores con el título 'Tu próximo auto, sin vueltas' y una pickup gris en el hero",
    tint: "#15161B",
    href: "/trabajo/capa-automotores",
  },
  {
    id: "suplementacionconciencia",
    slug: "suplementacion-ciencia",
    title: "Suplementación con Ciencia",
    description:
      "Tienda online de suplementos deportivos con información respaldada por ciencia y envíos a todo el país.",
    tag: "En producción",
    imageSrc: "/images/work/suplementacionconciencia.webp",
    imageAlt:
      "Página de inicio de Suplementación con Ciencia con encabezado teal, buscador y categorías de suplementos",
    tint: "#0E4B5F",
    href: "/trabajo/suplementacion-ciencia",
  },
  {
    id: "luxurycars",
    slug: "luxurycars",
    title: "Luxury Cars",
    description: "Plataforma suiza para comprar y vender autos de lujo.",
    tag: "En producción",
    imageSrc: "/images/work/luxurycars.webp",
    imageAlt:
      "Página de inicio de Luxury Cars con un Bentley claro al atardecer y el título 'La plateforme suisse de référence pour les voitures de luxe'",
    tint: "#5E3D33",
    href: "/trabajo/luxurycars",
  },
];
