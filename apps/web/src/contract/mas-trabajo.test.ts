import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { HTMLElement } from "node-html-parser";

import { workProjects } from "../data/work.ts";
import { readDistHtmlPages, type DistHtmlPage } from "./dist.ts";

const SITE = "https://neutro.solutions";
const CASE_ROUTE = /^\/trabajo\/[a-z0-9-]+$/;

function where(page: DistHtmlPage): string {
  return `dist/${page.relativePath} ruta ${page.route}`;
}

function visibleText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function pathnameOf(value: string): string | undefined {
  try {
    const url = new URL(value, `${SITE}/`);
    if (url.origin !== SITE) return undefined;
    if (url.pathname === "/") return "/";
    return url.pathname.replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

function sameList(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((href, index) => href === right[index])
  );
}

function othersInWorkOrder(route: string): string[] {
  return workProjects
    .filter((project) => project.href !== route)
    .map((project) => project.href);
}

function masTrabajo(document: HTMLElement): HTMLElement | undefined {
  const headings = document
    .querySelectorAll("h2")
    .filter((node) => visibleText(node.text) === "Más trabajo");
  if (headings.length !== 1) return undefined;
  const heading = headings[0];
  if (heading === undefined) return undefined;
  return heading.closest("aside") ?? undefined;
}

function cardHrefs(section: HTMLElement): string[] {
  return section.querySelectorAll("li.work-card").flatMap((card) => {
    const href = card.querySelector("a")?.getAttribute("href");
    if (href === undefined) return ["(sin href)"];
    return [pathnameOf(href) ?? href];
  });
}

describe("Más trabajo en la ficha (SEO-15)", () => {
  it("muestra en cada ficha los demás casos, en el orden de work.ts", () => {
    const pages = readDistHtmlPages();
    const routes = new Set(pages.map((page) => page.route));
    const cases = pages.filter((page) => CASE_ROUTE.test(page.route));
    const published = workProjects.map((project) => project.href);
    const expectedCount = workProjects.length - 1;
    const problems: string[] = [];

    if (workProjects.length < 2) {
      problems.push(
        `work.ts publica ${workProjects.length} casos; se necesitan al menos 2 para armar «Más trabajo»`,
      );
    }
    for (const project of workProjects) {
      if (project.href !== `/trabajo/${project.slug}`) {
        problems.push(
          `${project.id} href=${project.href}; se exige /trabajo/${project.slug}`,
        );
      }
    }

    const caseRoutes = cases.map((page) => page.route).sort();
    const publishedSorted = [...published].sort();
    if (!sameList(caseRoutes, publishedSorted)) {
      problems.push(
        `las fichas de dist (${caseRoutes.join(", ") || "ninguna"}) no son los href de work.ts (${publishedSorted.join(", ")})`,
      );
    }

    for (const page of cases) {
      const label = where(page);
      const headings = page.document
        .querySelectorAll("h2")
        .filter((node) => visibleText(node.text) === "Más trabajo");
      if (headings.length !== 1) {
        problems.push(
          `${label} tiene ${headings.length} títulos «Más trabajo»; se exige 1`,
        );
        continue;
      }
      const section = masTrabajo(page.document);
      if (section === undefined) {
        problems.push(`${label} «Más trabajo» no está dentro de un aside`);
        continue;
      }
      const found = cardHrefs(section);
      const expected = othersInWorkOrder(page.route);
      if (expected.length !== expectedCount) {
        problems.push(
          `${label} el resto de work.ts tiene ${expected.length} href; se exigen ${expectedCount}`,
        );
      }
      if (found.includes(page.route)) {
        problems.push(`${label} incluye la ficha propia ${page.route}`);
      }
      if (new Set(found).size !== found.length) {
        problems.push(`${label} repite tarjetas (${found.join(", ")})`);
      }
      for (const href of found) {
        if (!routes.has(href)) {
          problems.push(
            `${label} apunta a ${href}, que no es una página del dist`,
          );
        }
      }
      if (!sameList(found, expected)) {
        problems.push(
          `${label} Más trabajo tiene ${found.length} tarjetas (${found.join(", ") || "ninguna"}); se exigen ${expected.length} (work.ts menos la ficha) en ese orden (${expected.join(", ")})`,
        );
      }
    }

    assert.deepEqual(problems, [], problems.join("\n"));
  });
});
