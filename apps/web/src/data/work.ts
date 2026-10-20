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

export const workProjects: WorkProject[] = [
  {
    id: "lina",
    title: "Lina",
    description: "{Descripción Lina}",
    tag: "En producción",
    imageSrc: "/images/work/lina.jpg",
    imageAlt: "Vista previa del proyecto Lina",
    tint: "#073E26",
    href: "/trabajo/lina",
  },
  {
    id: "clara",
    title: "Clara",
    description: "{Descripción Clara}",
    tag: "En producción",
    imageSrc: "/images/work/clara.jpg",
    imageAlt: "Vista previa del proyecto Clara",
    tint: "#0A355C",
    href: null,
  },
  {
    id: "luxurycars",
    title: "LuxuryCars",
    description: "{Descripción LuxuryCars}",
    tag: "En producción",
    imageSrc: "/images/work/luxurycars.jpg",
    imageAlt: "Vista previa del proyecto LuxuryCars",
    tint: "#5A1F22",
    href: null,
  },
  {
    id: "h2hi",
    title: "H2HI",
    description: "{Descripción H2HI}",
    tag: "En producción",
    imageSrc: "/images/work/h2hi.jpg",
    imageAlt: "Vista previa del proyecto H2HI",
    tint: "#5A3A05",
    href: null,
  },
];
