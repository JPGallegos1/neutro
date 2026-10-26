import { expect, test, type Locator } from "@playwright/test";
import { workProjects } from "../src/data/work.ts";

const CARDS = 5;
const MAX_TABS = 40;

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

test("Tab llega a Cargar más con foco visible, Enter cambia aria-live y deja 5 cards", async ({
  page,
}) => {
  expect(workProjects, "hay 5 casos publicados").toHaveLength(CARDS);

  const response = await page.goto("/trabajo");
  expect(response?.ok(), "/trabajo").toBe(true);

  const main = page.getByRole("main");
  const cargarMas = main.getByRole("button", {
    name: "Cargar más",
    exact: true,
  });
  await expect(cargarMas).toBeVisible();

  const cards = main.getByRole("listitem", { includeHidden: true });
  await expect(cards).toHaveCount(CARDS);
  expect(await cardsVisibles(main)).toBeLessThan(CARDS);

  const live = main.locator("[aria-live]");
  await expect(live).toHaveCount(1);
  const textoAntes = (await live.textContent()) ?? "";

  let llego = false;
  for (let paso = 0; paso < MAX_TABS; paso += 1) {
    await page.keyboard.press("Tab");
    llego = await cargarMas.evaluate((el) => document.activeElement === el);
    if (llego) break;
  }

  expect(llego, "Tab no llegó a Cargar más").toBe(true);
  await expect(cargarMas).toBeFocused();

  const foco = await detalleDeFoco(cargarMas);
  expect(foco, foco ?? "foco visible").toBeNull();

  await page.keyboard.press("Enter");

  await expect
    .poll(async () => (await live.textContent()) ?? "")
    .not.toBe(textoAntes);

  await expect(cards).toHaveCount(CARDS);
  for (const card of await cards.all()) {
    await expect(card).toBeVisible();
  }

  for (const project of workProjects) {
    await expect(main.getByRole("link", { name: project.title })).toBeVisible();
  }

  expect(await cardsVisibles(main)).toBe(CARDS);
});
