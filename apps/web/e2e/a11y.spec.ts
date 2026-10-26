import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  etiquetasAxe,
  excepcionesAxe,
  temas,
  viewports,
  type ExcepcionAxe,
} from "./a11y-rutas.ts";
import { rutasEsperadas, rutasPublicas } from "./rutas-publicas.ts";

type Origen = "violacion" | "incompleto";

type NodoContraste = {
  html: string;
  target: unknown;
  any: { message: string }[];
  all: { message: string }[];
  none: { message: string }[];
  failureSummary?: string;
};

function textoDelNodo(nodo: NodoContraste): string {
  return [
    nodo.html,
    nodo.failureSummary ?? "",
    ...nodo.any.map((check) => check.message),
    ...nodo.all.map((check) => check.message),
    ...nodo.none.map((check) => check.message),
  ]
    .join("\n")
    .toLowerCase();
}

function esImagen(nodo: NodoContraste): boolean {
  const texto = textoDelNodo(nodo);
  return (
    /<img\b/.test(texto) ||
    texto.includes("background image") ||
    texto.includes("background-image") ||
    texto.includes("image node")
  );
}

function esSuperposicion(nodo: NodoContraste): boolean {
  const texto = textoDelNodo(nodo);
  return (
    texto.includes("overlapped") ||
    texto.includes("obscured") ||
    texto.includes("overlaps") ||
    texto.includes("pseudo element")
  );
}

function excepcionVigente(
  id: string,
  excepciones: readonly ExcepcionAxe[],
): boolean {
  return excepciones.some((item) => item.id === id && item.razon.trim() !== "");
}

function entraEnElReporte(
  origen: Origen,
  id: string,
  nodo: NodoContraste,
  excepciones: readonly ExcepcionAxe[] = excepcionesAxe,
): boolean {
  if (excepcionVigente(id, excepciones)) return false;
  if (
    origen === "incompleto" &&
    id === "color-contrast" &&
    (esImagen(nodo) || esSuperposicion(nodo))
  ) {
    return false;
  }
  return true;
}

function selectorDe(target: unknown): string {
  if (typeof target === "string") return target;
  if (Array.isArray(target)) {
    return target.map(selectorDe).filter(Boolean).join(" ");
  }
  return "";
}

function lineasDe(
  origen: Origen,
  resultados: { id: string; nodes: NodoContraste[] }[],
): string[] {
  return resultados.flatMap((resultado) =>
    resultado.nodes.flatMap((nodo) => {
      if (!entraEnElReporte(origen, resultado.id, nodo)) return [];
      const selector = selectorDe(nodo.target);
      return [`${resultado.id} | ${selector}`];
    }),
  );
}

test("las rutas públicas salen de las páginas y de los casos", () => {
  for (const ruta of rutasEsperadas) {
    expect(rutasPublicas, ruta).toContain(ruta);
  }
  expect(rutasPublicas.includes("/404")).toBe(false);
  expect(new Set(rutasPublicas).size).toBe(rutasPublicas.length);
});

test("sólo el contraste incompleto de imagen o superposición queda fuera del reporte", () => {
  const imagen: NodoContraste = {
    html: '<img alt="" src="/images/work/ejemplo.webp">',
    target: ["img"],
    any: [
      {
        message:
          "Element's background color could not be determined due to a background image",
      },
    ],
    all: [],
    none: [],
  };
  const overlay: NodoContraste = {
    html: "<span>En producción</span>",
    target: ["span"],
    any: [
      {
        message:
          "Element's background color could not be determined because it is overlapped by another element",
      },
    ],
    all: [],
    none: [],
  };
  const pseudo: NodoContraste = {
    html: "<span>En producción</span>",
    target: ["span"],
    any: [
      {
        message:
          "Element's background color could not be determined due to a pseudo element",
      },
    ],
    all: [],
    none: [],
  };
  const botonSinNombre: NodoContraste = {
    html: "<button></button>",
    target: ["button"],
    any: [{ message: "Element does not have an accessible name" }],
    all: [],
    none: [],
  };
  const contrasteSinMotivo: NodoContraste = {
    html: "<span>Texto</span>",
    target: ["span"],
    any: [{ message: "Unable to determine contrast ratio" }],
    all: [],
    none: [],
  };
  const excepcion: ExcepcionAxe = {
    id: "image-alt",
    razon: "ejemplo de una excepción con motivo",
  };

  expect(entraEnElReporte("incompleto", "color-contrast", imagen)).toBe(false);
  expect(entraEnElReporte("incompleto", "color-contrast", overlay)).toBe(false);
  expect(entraEnElReporte("incompleto", "color-contrast", pseudo)).toBe(false);
  expect(entraEnElReporte("incompleto", "button-name", botonSinNombre)).toBe(
    true,
  );
  expect(
    entraEnElReporte("incompleto", "color-contrast", contrasteSinMotivo),
  ).toBe(true);
  expect(entraEnElReporte("violacion", "color-contrast", imagen)).toBe(true);
  expect(entraEnElReporte("violacion", "image-alt", imagen, [excepcion])).toBe(
    false,
  );
  expect(entraEnElReporte("violacion", "image-alt", imagen, [])).toBe(true);
});

for (const ruta of rutasPublicas) {
  for (const tema of temas) {
    for (const viewport of viewports) {
      test(`${ruta} ${tema.nombre} ${viewport.nombre}`, async ({ page }) => {
        test.setTimeout(60_000);
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await page.emulateMedia({ colorScheme: tema.valor });
        await page.addInitScript((value: string) => {
          localStorage.setItem("neutro-theme", value);
        }, tema.valor);

        const response = await page.goto(ruta);
        expect(response?.ok(), ruta).toBe(true);

        const oscuro = await page
          .locator("html")
          .evaluate((el) => el.classList.contains("dark"));
        expect(oscuro, tema.nombre).toBe(tema.valor === "dark");

        const results = await new AxeBuilder({ page })
          .withTags([...etiquetasAxe])
          .analyze();

        const fallas = [
          ...lineasDe("violacion", results.violations),
          ...lineasDe("incompleto", results.incomplete),
        ].map((linea) => {
          const corte = linea.indexOf(" | ");
          const regla = corte === -1 ? linea : linea.slice(0, corte);
          const selector = corte === -1 ? "" : linea.slice(corte + 3);
          return `${regla} | ${ruta} | ${selector} | ${tema.nombre} | ${viewport.nombre}`;
        });

        expect(fallas, fallas.join("\n")).toEqual([]);
      });
    }
  }
}
