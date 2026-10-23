export type ServiceItem = {
  label: string;
  benefit: string;
};

type ServiceCategoryBase = {
  id: string;
  title: string;
  summary: string;
  defaultOpen?: boolean;
};

export type ListedServiceCategory = ServiceCategoryBase & {
  body: "services";
  services: readonly ServiceItem[];
};

export type TaggedServiceCategory = ServiceCategoryBase & {
  body: "tags";
  tags: readonly string[];
};

export type ServiceCategory = ListedServiceCategory | TaggedServiceCategory;

const REQUIRED_SERVICE_IDS = [
  "web",
  "diseno",
  "sistemas",
  "tienda-online",
  "automatizacion-ia",
] as const;

export function serviceCopy(value: unknown, where: string): string {
  if (typeof value !== "string") {
    throw new Error(`Falta contenido de servicio en ${where}`);
  }
  const text = value.trim();
  if (text.length === 0 || text.toLowerCase() === "null") {
    throw new Error(`Falta contenido de servicio en ${where}`);
  }
  return value;
}

export function validateServiceCategories(
  categories: readonly ServiceCategory[],
): void {
  if (
    categories.length !== REQUIRED_SERVICE_IDS.length ||
    categories.some(
      (category, index) => category?.id !== REQUIRED_SERVICE_IDS[index],
    )
  ) {
    throw new Error(
      `Falta contenido de servicio: se esperaban ${REQUIRED_SERVICE_IDS.join(", ")}`,
    );
  }

  for (const category of categories) {
    const where = category?.id ?? "categoria";
    serviceCopy(category?.title, `${where}.title`);
    serviceCopy(category?.summary, `${where}.summary`);
    const body = category?.body;
    if (body === "services") {
      if (category.services.length === 0) {
        throw new Error(`Falta contenido de servicio en ${where}.services`);
      }
      category.services.forEach((service, index) => {
        serviceCopy(service?.label, `${where}.services[${index}].label`);
        serviceCopy(service?.benefit, `${where}.services[${index}].benefit`);
      });
    } else if (body === "tags") {
      if (category.tags.length === 0) {
        throw new Error(`Falta contenido de servicio en ${where}.tags`);
      }
      category.tags.forEach((tag, index) => {
        serviceCopy(tag, `${where}.tags[${index}]`);
      });
    } else {
      throw new Error(`Falta contenido de servicio en ${where}.body`);
    }
  }
}

export const serviceCategories: ServiceCategory[] = [
  {
    id: "web",
    title: "Web",
    defaultOpen: true,
    body: "services",
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
    body: "services",
    summary:
      "Tu marca y tus pantallas, definidas con vos antes de escribir código.",
    services: [
      {
        label: "IDENTIDAD DE MARCA",
        benefit: "Definimos juntos tu logo, colores y tipografía.",
      },
      {
        label: "PANTALLAS Y PROTOTIPO",
        benefit:
          "Ves y recorrés tu web o sistema como si ya existiera, antes de construirlo.",
      },
      {
        label: "MANUAL DE MARCA",
        benefit:
          "Tus colores, letras y reglas ordenados, para que todo se vea igual.",
      },
      {
        label: "TONO Y MENSAJES",
        benefit: "Cómo le habla tu negocio a tus clientes, en cada lugar.",
      },
    ],
  },
  {
    id: "sistemas",
    title: "Sistemas",
    body: "services",
    summary:
      "Lo que hoy vive en tu cabeza y en cuadernos, ordenado en un solo lugar.",
    services: [
      {
        label: "GESTIÓN DE PEDIDOS",
        benefit:
          "Cada pedido, del chat a la entrega, con lo que tenés en stock.",
      },
      {
        label: "FICHA DE CLIENTES",
        benefit:
          "El historial de cada cliente a mano, sin depender de tu memoria.",
      },
      {
        label: "CAJA Y COBRANZAS",
        benefit: "Lo que entra, lo que sale y quién te debe, claro.",
      },
      {
        label: "ORGANIZACIÓN DEL EQUIPO",
        benefit: "Cada uno sabe qué hacer y vos ves en qué está.",
      },
    ],
  },
  {
    id: "tienda-online",
    title: "Tienda online",
    body: "tags",
    summary:
      "Vender por WhatsApp funciona hasta que los pedidos se pierden entre chats y el stock no cierra. Te armamos una tienda que vende sola todos los días, con envíos a todo el país y el mismo stock en WhatsApp, Mercado Libre y Google. Si ya tenés web, la sumamos ahí sin rehacerla. Vos te ocupás del negocio y la tienda se ocupa de vender.",
    tags: [
      "TIENDA ONLINE",
      "ENVÍOS A TODO EL PAÍS",
      "VENTA EN MÁS CANALES",
      "RECUPERO DE CARRITOS",
      "STOCK Y GESTIÓN CONECTADOS",
      "MIGRACIÓN",
      "TIENDA EN TU WEB ACTUAL",
    ],
  },
  {
    id: "automatizacion-ia",
    title: "Automatización con IA",
    body: "services",
    summary: "Lo que hoy hacés a mano, lo hacemos funcionar solo.",
    services: [
      {
        label: "ASISTENTE DE IA",
        benefit:
          "Responde consultas en WhatsApp y en tu web, aunque estés ocupado.",
      },
      {
        label: "RECORDATORIOS Y SEGUIMIENTO",
        benefit:
          "Avisos automáticos de turnos, pedidos y pagos pendientes, sin que escribas vos.",
      },
      {
        label: "AUTOMATIZACIÓN DE TAREAS",
        benefit: "Lo que repetís todos los días, funcionando solo.",
      },
      {
        label: "INTEGRACIONES",
        benefit: "Conectamos tus herramientas para que los datos pasen solos.",
      },
    ],
  },
];

validateServiceCategories(serviceCategories);
