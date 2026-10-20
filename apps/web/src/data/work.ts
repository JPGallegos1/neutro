export type WorkProject = {
  id: string;
  title: string;
  description: string;
  tag: string;
  imageSrc: string;
  imageAlt: string;
  tint: string;
  href: string | null;
};

/**
 * Datos del frame A · v29. Descripciones e imágenes son provisionales
 * (placeholders del .pen / Unsplash). Solo Lina enlaza a caso de estudio.
 */
export const workProjects: WorkProject[] = [
  {
    id: "lina",
    title: "Lina",
    description: "{Descripción Lina}",
    tag: "En producción",
    imageSrc:
      "https://images.unsplash.com/photo-1785682231847-93265d8e633d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    imageAlt: "Vista previa del proyecto Lina",
    tint: "#073E2652",
    // Ruta placeholder: no existe página de caso de estudio en el repo.
    href: "/trabajo/lina",
  },
  {
    id: "clara",
    title: "Clara",
    description: "{Descripción Clara}",
    tag: "En producción",
    imageSrc:
      "https://images.unsplash.com/photo-1557158077-ad1155133508?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    imageAlt: "Vista previa del proyecto Clara",
    tint: "#0A355C52",
    href: null,
  },
  {
    id: "luxurycars",
    title: "LuxuryCars",
    description: "{Descripción LuxuryCars}",
    tag: "En producción",
    imageSrc:
      "https://images.unsplash.com/photo-1618863099278-75222d755814?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    imageAlt: "Vista previa del proyecto LuxuryCars",
    tint: "#5A1F2252",
    href: null,
  },
  {
    id: "h2hi",
    title: "H2HI",
    description: "{Descripción H2HI}",
    tag: "En producción",
    imageSrc:
      "https://images.unsplash.com/photo-1784821856280-401b76b03266?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    imageAlt: "Vista previa del proyecto H2HI",
    tint: "#5A3A0552",
    href: null,
  },
];
