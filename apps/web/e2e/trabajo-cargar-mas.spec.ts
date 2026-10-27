import { expect, test, type Locator, type Page } from "@playwright/test";
import { workProjects } from "../src/data/work.ts";

const CARDS_PUBLICADAS = 5;
const PAGE_SIZE = 4;
const CARDS_NUEVE = 9;
const MAX_TABS = 40;

const ANUNCIO_UNO = "Se cargó 1 proyecto más.";
const anuncioVarios = (n: number) => `Se cargaron ${n} proyectos más.`;

const EXTRAS_PARA_NUEVE = [
  { slug: "extra-alfa", title: "Extra Alfa" },
  { slug: "extra-beta", title: "Extra Beta" },
  { slug: "extra-gamma", title: "Extra Gamma" },
  { slug: "extra-delta", title: "Extra Delta" },
] as const;

async function detalleDeFoco(control: Locator): Promise<string | null> {
  return control.evaluate((el) => {
    if (document.activeElement !== el) {
      return "el elemento activo no es Cargar más";
    }

    const style = getComputedStyle(el);
    const width = Number.parseFloat(style.outlineWidth);
    const color = style.outlineColor.trim().toLowerCase();
    const transparente =
      color === "transparent" ||
      /^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*0(?:\.0+)?\s*\)$/.test(
        color,
      );
    const outline =
      style.outlineStyle !== "none" &&
      !transparente &&
      (style.outlineStyle === "auto" || (Number.isFinite(width) && width > 0));
    const shadow = style.boxShadow.trim();
    const sombra =
      shadow !== "" &&
      shadow !== "none" &&
      !/^rgba?\([^)]*,\s*0(?:\.0+)?\s*\)(?:\s+0px){4}$/.test(shadow);

    if (outline || sombra) return null;

    return `outline-style:${style.outlineStyle}; outline-width:${style.outlineWidth}; outline-color:${style.outlineColor}; box-shadow:${shadow}`;
  });
}

async function cardsVisibles(main: Locator): Promise<number> {
  const cards = main.getByRole("listitem", { includeHidden: true });
  let visibles = 0;
  for (const card of await cards.all()) {
    if (await card.isVisible()) visibles += 1;
  }
  return visibles;
}

function enlaceDeCard(main: Locator, index: number): Locator {
  return main
    .getByRole("listitem", { includeHidden: true })
    .nth(index)
    .locator("a.work-card__inner");
}

async function tabHastaCargarMas(
  page: Page,
  cargarMas: Locator,
): Promise<void> {
  let llego = false;
  for (let paso = 0; paso < MAX_TABS; paso += 1) {
    await page.keyboard.press("Tab");
    llego = await cargarMas.evaluate((el) => document.activeElement === el);
    if (llego) break;
  }
  expect(llego, "Tab no llegó a Cargar más").toBe(true);
  await expect(cargarMas).toBeFocused();
}

function esDocumentoTrabajo(url: URL): boolean {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  return path === "/trabajo" || path === "/trabajo.html";
}

function conNueveCards(html: string): string {
  const cardRe = /<li class="work-card"[\s\S]*?<\/li>/g;
  const existentes = html.match(cardRe);
  if (!existentes || existentes.length !== CARDS_PUBLICADAS) {
    throw new Error(
      `se esperaban ${CARDS_PUBLICADAS} cards en /trabajo para clonar; hay ${existentes?.length ?? 0}`,
    );
  }

  const clones = EXTRAS_PARA_NUEVE.map((extra, i) => {
    let card = existentes[i % existentes.length] ?? "";
    card = card.replace(
      /href="\/trabajo\/[^"]+"/,
      `href="/trabajo/${extra.slug}"`,
    );
    card = card.replace(
      /(<h2 class="work-card__title"[^>]*>)([\s\S]*?)(<\/h2>)/,
      `$1${extra.title}$3`,
    );
    card = card.replace(/\sloading="eager"/, ' loading="lazy"');
    card = card.replace(/\sfetchpriority="high"/, "");
    return card;
  }).join("");

  const gridRe = /(<ul\b[^>]*\bdata-work-grid\b[^>]*>)([\s\S]*?)(<\/ul>)/;
  if (!gridRe.test(html)) {
    throw new Error("no se encontró ul[data-work-grid] en /trabajo");
  }
  return html.replace(gridRe, `$1$2${clones}$3`);
}

async function servirTrabajoConNueveCards(page: Page): Promise<void> {
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (request.resourceType() !== "document") {
      await route.continue();
      return;
    }
    const url = new URL(request.url());
    if (!esDocumentoTrabajo(url)) {
      await route.continue();
      return;
    }

    const response = await route.fetch();
    const html = await response.text();
    const headers = { ...response.headers() };
    headers["content-type"] = "text/html; charset=utf-8";
    await route.fulfill({
      status: response.status(),
      headers,
      body: conNueveCards(html),
    });
  });
}

async function assertFocoEnCardNueva(
  page: Page,
  main: Locator,
  index: number,
): Promise<void> {
  const link = enlaceDeCard(main, index);
  await expect(link).toBeVisible();
  await expect(link).toBeFocused();

  const activo = await page.evaluate(() => {
    const el = document.activeElement;
    if (!(el instanceof HTMLElement)) {
      return { kind: "none" as const };
    }
    return {
      kind: "element" as const,
      tag: el.tagName,
      className: el.className,
      hidden: el.hidden,
      isBody: el === document.body,
      isButton: el.tagName === "BUTTON",
    };
  });

  expect(activo.kind, "document.activeElement ausente").toBe("element");
  if (activo.kind !== "element") return;
  expect(activo.isBody, "el foco quedó en body").toBe(false);
  expect(activo.isButton, "el foco quedó en el botón").toBe(false);
  expect(activo.hidden, "el foco quedó en un elemento hidden").toBe(false);
  expect(activo.tag).toBe("A");
  expect(activo.className.split(/\s+/)).toContain("work-card__inner");
}

test.describe("Cargar más en /trabajo", () => {
  test("Tab llega a Cargar más con foco visible", async ({ page }) => {
    expect(workProjects, "hay 5 casos publicados").toHaveLength(
      CARDS_PUBLICADAS,
    );

    const response = await page.goto("/trabajo");
    expect(response?.ok(), "/trabajo").toBe(true);

    const main = page.getByRole("main");
    const cargarMas = main.getByRole("button", {
      name: "Cargar más",
      exact: true,
      includeHidden: true,
    });
    await expect(cargarMas).toBeVisible();
    expect(await cardsVisibles(main)).toBe(PAGE_SIZE);

    await tabHastaCargarMas(page, cargarMas);

    const foco = await detalleDeFoco(cargarMas);
    expect(foco, foco ?? "foco visible").toBeNull();
  });

  test("con 5 casos: Enter carga 1, anuncia, enfoca la 5.ª y oculta el botón", async ({
    page,
  }) => {
    expect(workProjects, "hay 5 casos publicados").toHaveLength(
      CARDS_PUBLICADAS,
    );

    const response = await page.goto("/trabajo");
    expect(response?.ok(), "/trabajo").toBe(true);

    const main = page.getByRole("main");
    const cards = main.getByRole("listitem", { includeHidden: true });
    const cargarMas = main.getByRole("button", {
      name: "Cargar más",
      exact: true,
      includeHidden: true,
    });
    const more = main.locator("[data-work-more]");
    const live = main.locator("[data-work-live]");

    await expect(cards).toHaveCount(CARDS_PUBLICADAS);
    await expect(cargarMas).toBeVisible();
    await expect(more).toBeVisible();
    expect(await cardsVisibles(main)).toBe(PAGE_SIZE);
    await expect(live).toHaveText("");

    await tabHastaCargarMas(page, cargarMas);
    await page.keyboard.press("Enter");

    await expect(live).toHaveText(ANUNCIO_UNO);
    expect(await cardsVisibles(main)).toBe(CARDS_PUBLICADAS);
    for (const card of await cards.all()) {
      await expect(card).toBeVisible();
    }
    for (const project of workProjects) {
      await expect(
        main.getByRole("link", { name: project.title }),
      ).toBeVisible();
    }

    await assertFocoEnCardNueva(page, main, PAGE_SIZE);

    await expect(cargarMas).toBeHidden();
    await expect(cargarMas).toHaveAttribute("hidden", "");
    await expect(more).toBeHidden();
    await expect(more).toHaveAttribute("hidden", "");
  });

  test("con 5 casos: el clic de mouse carga el restante y oculta el botón", async ({
    page,
  }) => {
    expect(workProjects, "hay 5 casos publicados").toHaveLength(
      CARDS_PUBLICADAS,
    );

    const response = await page.goto("/trabajo");
    expect(response?.ok(), "/trabajo").toBe(true);

    const main = page.getByRole("main");
    const cargarMas = main.getByRole("button", {
      name: "Cargar más",
      exact: true,
      includeHidden: true,
    });
    const more = main.locator("[data-work-more]");
    const live = main.locator("[data-work-live]");

    await expect(cargarMas).toBeVisible();
    expect(await cardsVisibles(main)).toBe(PAGE_SIZE);

    await cargarMas.click();

    await expect(live).toHaveText(ANUNCIO_UNO);
    expect(await cardsVisibles(main)).toBe(CARDS_PUBLICADAS);
    await assertFocoEnCardNueva(page, main, PAGE_SIZE);
    await expect(cargarMas).toHaveAttribute("hidden", "");
    await expect(more).toHaveAttribute("hidden", "");
  });

  test("con 9 casos: dos cargas revelan de a 4 o menos, anuncian, enfocan y ocultan", async ({
    page,
  }) => {
    await servirTrabajoConNueveCards(page);

    const response = await page.goto("/trabajo");
    expect(response?.ok(), "/trabajo").toBe(true);

    const main = page.getByRole("main");
    const cards = main.getByRole("listitem", { includeHidden: true });
    const cargarMas = main.getByRole("button", {
      name: "Cargar más",
      exact: true,
      includeHidden: true,
    });
    const more = main.locator("[data-work-more]");
    const live = main.locator("[data-work-live]");

    await expect(cards).toHaveCount(CARDS_NUEVE);
    await expect(cargarMas).toBeVisible();
    expect(await cardsVisibles(main)).toBe(PAGE_SIZE);

    await tabHastaCargarMas(page, cargarMas);
    await page.keyboard.press("Enter");

    await expect(live).toHaveText(anuncioVarios(PAGE_SIZE));
    expect(await cardsVisibles(main)).toBe(PAGE_SIZE * 2);
    await assertFocoEnCardNueva(page, main, PAGE_SIZE);
    await expect(cargarMas).toBeVisible();
    await expect(more).toBeVisible();
    await expect(cargarMas).not.toHaveAttribute("hidden");
    await expect(more).not.toHaveAttribute("hidden");

    await cargarMas.focus();
    await expect(cargarMas).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(live).toHaveText(ANUNCIO_UNO);
    expect(await cardsVisibles(main)).toBe(CARDS_NUEVE);
    await assertFocoEnCardNueva(page, main, CARDS_NUEVE - 1);
    await expect(cargarMas).toBeHidden();
    await expect(cargarMas).toHaveAttribute("hidden", "");
    await expect(more).toBeHidden();
    await expect(more).toHaveAttribute("hidden", "");

    for (const extra of EXTRAS_PARA_NUEVE) {
      await expect(main.getByRole("link", { name: extra.title })).toBeVisible();
    }
  });
});
