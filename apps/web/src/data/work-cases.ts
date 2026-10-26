import { workProjects, type WorkProject } from "./work.ts";

export type WorkCaseFact = {
  label: string;
  value: string;
};

export type WorkCaseQuote = {
  text: string;
  lang?: "fr";
};

export type WorkCase = {
  slug: string;
  projectId: string;
  shortTitle: string;
  titleLines: string[];
  clientName: string;
  outcomeTitle: string | null;
  metaDescription: string;
  tag: string;
  externalUrl: string;
  imageSrc: string;
  imageAlt: string;
  clientIntro: string;
  facts: WorkCaseFact[];
  context: string;
  problem: string;
  whatWeDid: string[];
  howWeSolved: string;
  quote: WorkCaseQuote;
  quoteFollowup: string | null;
  learnings: string[];
};

export const workCases: WorkCase[] = [
  {
    slug: "conexion-laboral",
    projectId: "conexlaboral",
    shortTitle: "Conexión Laboral",
    titleLines: ["Conexión Laboral"],
    clientName: "Conexión Laboral",
    outcomeTitle: "agendar una asesoría gratuita con una sola página",
    metaDescription:
      "Reclutamiento para PyMEs en Argentina: busca, filtra y presenta los 3 mejores candidatos con informe. Una sola página para agendar asesoría gratuita.",
    tag: "En producción",
    externalUrl: "https://conexlaboral.com",
    imageSrc: "/images/work/conexlaboral.webp",
    imageAlt:
      "Página de inicio de Conexión Laboral con el título 'Cubrí la vacante que necesitás' y dos personas dándose la mano",
    clientIntro:
      "Reclutamiento para PyMEs en Argentina: busca, filtra y presenta los 3 mejores candidatos con informe.",
    facts: [
      { label: "Cliente", value: "Conexión Laboral" },
      { label: "Rubro", value: "Reclutamiento y selección de personal" },
      { label: "Mercado", value: "PyMEs de Argentina" },
    ],
    context:
      "Conexión Laboral ayuda a PyMEs a cubrir vacantes sin que el reclutamiento les quite tiempo. Cuando empezamos a trabajar juntos no tenía sitio propio: los clientes llegaban por contacto directo.",
    problem:
      "Sin un lugar donde explicar qué hace, no se entendía rápido qué ofrecía Conexión Laboral. Tampoco había un camino claro para que un dueño de PyME diera el primer paso y agendara una asesoría.",
    whatWeDid: [
      "Web: sitio de una sola página, con textos y estructura pensados para una única acción.",
      "Diseño: diseño de la página.",
      "Agendado de una asesoría gratuita como acción principal, y botón flotante de WhatsApp.",
      "Analítica con Google Tag Manager desde el lanzamiento.",
    ],
    howWeSolved:
      "Elegimos una sola página con un solo objetivo: que quien llega agende una asesoría gratuita. Propusimos arrancar por el costo de contratar mal, no por los servicios, y el cliente validó los textos.",
    quote: { text: "Contratar mal sale más caro que no contratar." },
    quoteFollowup:
      "Las cifras que muestra el sitio (3 finalistas, 15 días de cobertura promedio, 30 días de reemplazo) las aportó el cliente, que conoce su proceso. Nosotros las ordenamos para que se entiendan de un vistazo.",
    learnings: [
      "Un sitio de una sola página, con un mensaje claro y una sola acción, alcanza para una PyME de servicios.",
      "Conviene empezar por el costo del problema del cliente y no por la lista de servicios.",
      "Hoy definiríamos desde el inicio cómo se mide el éxito del sitio, por ejemplo cuántas asesorías se agendan, en vez de solo lanzarlo.",
    ],
  },
  {
    slug: "afectiva",
    projectId: "afectiva",
    shortTitle: "Afectiva",
    titleLines: ["Afectiva"],
    clientName: "Afectiva Comunicaciones",
    outcomeTitle: "un sitio propio para mostrar todo lo que hace la agencia",
    metaDescription:
      "Agencia de comunicación: estrategia, diseño, contenido y producción para marcas con historia. Sitio de una página con WhatsApp como acción principal.",
    tag: "En producción",
    externalUrl: "https://afectiva.vercel.app",
    imageSrc: "/images/work/afectiva.webp",
    imageAlt:
      "Página de inicio de Afectiva Comunicaciones con el título 'Impulsamos tu marca en el mundo digital' y un sello circular violeta",
    clientIntro:
      "Agencia de comunicación: estrategia, diseño, contenido y producción para marcas con historia.",
    facts: [
      {
        label: "Cliente",
        value:
          "Afectiva Comunicaciones (Lic. Adriana Rojas y Lic. Lucia Basaldella)",
      },
      { label: "Rubro", value: "Comunicación y marketing de marcas" },
      { label: "Mercado", value: "Argentina" },
    ],
    context:
      "Afectiva Comunicaciones es una agencia que ofrece estrategia, diseño, fotografía, publicidad, contenido, filmación, mentorías y conducción de eventos. Cuando empezamos a trabajar juntos no tenía sitio propio y se mostraba solo por Instagram y WhatsApp.",
    problem:
      "Los servicios y el trabajo de la agencia estaban repartidos en redes. No había un lugar que los mostrara juntos, ni un camino claro para escribirles.",
    whatWeDid: [
      "Web: sitio de una sola página con servicios, proceso en tres pasos, un caso de eventos, clientes, equipo y contacto.",
      "Diseño: diseño de la página a partir de la marca del cliente, adaptada a la web.",
      "Contacto por WhatsApp como acción principal.",
    ],
    howWeSolved:
      'Armamos una sola página para que se entienda de corrido todo lo que hace la agencia y que la acción final sea escribirles por WhatsApp. Los textos y el tono, en femenino plural y con el lema "Pequeñas ideas, grandes logros", vienen del cliente. Nosotros los ordenamos en secciones y los llevamos al diseño.',
    quote: { text: "Crecer no es hacer más ruido, es conectar mejor." },
    quoteFollowup: null,
    learnings: [
      "Para una agencia, el sitio tiene que mostrar el tono y la forma de trabajar del cliente, no solo la lista de servicios.",
      "Hoy definiríamos desde el inicio cómo se mide el sitio, por ejemplo cuántos contactos llegan por WhatsApp.",
      "Hoy lo publicaríamos con dominio propio.",
    ],
  },
  {
    slug: "capa-automotores",
    projectId: "capaautomotores",
    shortTitle: "Capa",
    titleLines: ["Capa"],
    clientName: "Capa Automotores",
    outcomeTitle: "un catálogo propio con panel para manejar el stock",
    metaDescription:
      "Concesionaria de usados y 0km en Rosario, con financiación hasta 60% y toma de tu usado. Catálogo propio con panel para actualizar el stock.",
    tag: "En producción",
    externalUrl: "https://capaautomotores.com",
    imageSrc: "/images/work/capaautomotores.webp",
    imageAlt:
      "Página de inicio de Capa Automotores con el título 'Tu próximo auto, sin vueltas' y una pickup gris en el hero",
    clientIntro:
      "Concesionaria de usados y 0km en Rosario, con financiación hasta 60% y toma de tu usado en parte de pago.",
    facts: [
      { label: "Cliente", value: "Capa Automotores" },
      { label: "Rubro", value: "Compraventa de autos usados y 0km" },
      { label: "Mercado", value: "Rosario, Santa Fe" },
    ],
    context:
      "Capa Automotores vende autos, SUV, pickups y motos usados y 0km en Rosario. Cuando empezamos a trabajar juntos no tenía sitio propio: el inventario se publicaba en redes y se consultaba por WhatsApp.",
    problem:
      "Capa no tenía un catálogo propio que mostrar, y mantener el stock actualizado en varios lugares le tomaba tiempo.",
    whatWeDid: [
      "Web: sitio con inventario filtrable por tipo de vehículo, marca, año, kilómetros, combustible y transmisión, y páginas de financiación y de toma de usados.",
      "Diseño: diseño del sitio.",
      "Sistemas: panel de administración para cargar, editar y dar de baja vehículos con sus fotos, y destacar los del home, sin depender de Neutro.",
      "Contacto por WhatsApp como acción principal.",
    ],
    howWeSolved:
      "Armamos un catálogo propio con un panel de administración para que Capa maneje su stock sin depender de terceros ni de Neutro. Las condiciones comerciales (financiación hasta 60% solo con DNI, tasación sin compromiso) son del cliente. Nosotros propusimos mostrarlas de forma simple y directa.",
    quote: { text: "Tu próximo auto, sin vueltas." },
    quoteFollowup: null,
    learnings: [
      "Para una concesionaria, el valor está en que el cliente pueda actualizar su stock solo, no solo en tener un sitio lindo.",
      "Hoy revisaríamos desde el inicio que cada página tenga título y descripción para buscadores.",
      "Hoy mediríamos cuántas consultas llegan por WhatsApp.",
    ],
  },
  {
    slug: "suplementacion-ciencia",
    projectId: "suplementacionconciencia",
    shortTitle: "SCC",
    titleLines: ["SCC"],
    clientName: "Suplementación con Ciencia",
    outcomeTitle:
      "una tienda online que muestra la ciencia detrás",
    metaDescription:
      "Tienda online de suplementos deportivos con información respaldada por ciencia y envíos a todo el país. Catálogo, pagos y diseño a medida sobre Tiendanube.",
    tag: "En producción",
    externalUrl: "https://suplementacionconciencia.com.ar",
    imageSrc: "/images/work/suplementacionconciencia.webp",
    imageAlt:
      "Página de inicio de Suplementación con Ciencia con encabezado teal, buscador y categorías de suplementos",
    clientIntro:
      "Tienda online de suplementos deportivos con información respaldada por ciencia y envíos a todo el país.",
    facts: [
      { label: "Cliente", value: "Suplementación con Ciencia" },
      { label: "Rubro", value: "Suplementación deportiva" },
      { label: "Mercado", value: "Argentina" },
    ],
    context:
      "Suplementación con Ciencia vende suplementos deportivos (proteínas, creatinas, aminoácidos, pre entrenos, geles, vitaminas, shakers, combos y gift cards) con una promesa: información confiable, respaldada por ciencia y sin falsas promesas. Cuando empezamos a trabajar juntos vendía por Instagram y WhatsApp, sin tienda online propia.",
    problem:
      "Los pedidos y los pagos se manejaban a mano por mensajes. Tampoco había un lugar que mostrara el catálogo y la propuesta de ciencia.",
    whatWeDid: [
      "Tienda online: tienda sobre Tiendanube con catálogo por categorías, pagos online, envíos a todo el país, combos y gift cards, con la carga inicial del catálogo.",
      "Diseño: diseño a medida de la tienda, a partir de la marca del cliente.",
    ],
    howWeSolved:
      "Elegimos Tiendanube porque el cliente puede manejar la tienda sola, con pagos y envíos ya resueltos, sin depender de Neutro. Así pusimos el esfuerzo en el diseño y en el mensaje. La promesa de información respaldada por ciencia es del cliente, y propusimos mostrarla de forma visible en la tienda.",
    quote: {
      text: "Información confiable respaldada por ciencia, sin falsas promesas.",
    },
    quoteFollowup: null,
    learnings: [
      "Para una tienda chica conviene apoyarse en una plataforma que el cliente pueda manejar sola, y poner el esfuerzo en el diseño y en el mensaje.",
      "Hoy mediríamos desde el inicio de dónde llegan las compras (Instagram, WhatsApp o búsqueda) para saber qué canal funciona.",
    ],
  },
  {
    slug: "luxurycars",
    projectId: "luxurycars",
    shortTitle: "Luxury Cars",
    titleLines: ["Luxury", "Cars"],
    clientName: "Luxury Cars",
    outcomeTitle:
      "una plataforma a medida para el mercado de autos de lujo en Suiza",
    metaDescription:
      "Plataforma suiza de referencia para comprar y vender autos de lujo online, con buscador, anuncios, cuentas de usuarios y concesionarias, y varios idiomas.",
    tag: "En producción",
    externalUrl: "https://luxurycars.ch",
    imageSrc: "/images/work/luxurycars.webp",
    imageAlt:
      "Página de inicio de LuxuryCars con un Bentley claro al atardecer y el título 'La plateforme suisse de référence pour les voitures de luxe'",
    clientIntro:
      "Plataforma suiza de referencia para comprar y vender autos de lujo online.",
    facts: [
      { label: "Cliente", value: "Luxury Cars" },
      { label: "Rubro", value: "Compraventa de autos de lujo" },
      { label: "Mercado", value: "Suiza" },
    ],
    context:
      "Luxury Cars es una plataforma suiza para comprar y vender autos de lujo, nuevos y usados. Era un proyecto nuevo, sin plataforma previa.",
    problem:
      "No había una plataforma suiza de referencia, simple y transparente, para comprar y vender autos de lujo.",
    whatWeDid: [
      "Web: plataforma con buscador, publicación de anuncios, cuentas de usuarios y concesionarias, secciones de noticias, varios idiomas y anuncios destacados.",
      "Diseño: diseño de la plataforma.",
      "Sistemas: el sistema detrás de la plataforma, con anuncios, cuentas y concesionarias.",
    ],
    howWeSolved:
      "Construimos una plataforma a medida, para que el cliente controle el negocio y su modelo de ingresos, con anuncios destacados y concesionarias. El posicionamiento (prestigio, facilidad de uso y transparencia) es del cliente. Nosotros lo llevamos al diseño y a la experiencia de uso.",
    quote: {
      text: "La plateforme suisse de référence pour les voitures de luxe.",
      lang: "fr",
    },
    quoteFollowup: null,
    learnings: [
      "Una plataforma con dos lados, compradores y vendedores, necesita pensar primero la experiencia de cada uno antes que las funciones.",
      "Hoy mediríamos desde el inicio cuántos anuncios se publican y cuántas consultas reciben, para saber si la plataforma funciona para ambos lados.",
    ],
  },
];

export function workCasePath(slug: string): string {
  return `/trabajo/${slug}`;
}

export function workCaseCanonical(slug: string): string {
  return `https://neutro.solutions${workCasePath(slug)}`;
}

export function workCaseDocumentTitle(workCase: WorkCase): string {
  if (workCase.outcomeTitle) {
    return `${workCase.clientName}: ${workCase.outcomeTitle} | Neutro Solutions`;
  }
  return `${workCase.clientName} | Neutro Solutions`;
}

export function getWorkCase(slug: string): WorkCase | undefined {
  return workCases.find((item) => item.slug === slug);
}

export function relatedWorkProjects(slug: string, count = 3): WorkProject[] {
  const current = getWorkCase(slug);
  if (!current) return [];
  const others = workProjects.filter(
    (project) => project.id !== current.projectId,
  );
  return others.slice(0, count);
}
