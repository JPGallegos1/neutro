import { expect, test } from "@playwright/test";
import { workProjects } from "../src/data/work.ts";

const CARDS = 5;

test.use({ javaScriptEnabled: false });

test("sin JavaScript, /trabajo muestra las 5 cards y no muestra Cargar más", async ({
  page,
}) => {
  expect(workProjects, "hay 5 casos publicados").toHaveLength(CARDS);

  const response = await page.goto("/trabajo");
  expect(response?.ok(), "/trabajo").toBe(true);

  const main = page.getByRole("main");
  const cards = main.getByRole("listitem", { includeHidden: true });
  await expect(cards).toHaveCount(CARDS);

  for (const card of await cards.all()) {
    await expect(card).toBeVisible();
  }

  for (const project of workProjects) {
    await expect(main.getByRole("link", { name: project.title })).toBeVisible();
  }

  const cargarMas = main.getByRole("button", {
    name: "Cargar más",
    exact: true,
    includeHidden: true,
  });
  await expect(cargarMas).toHaveCount(1);
  await expect(cargarMas).toBeHidden();
  await expect(cargarMas).toHaveAttribute("hidden", "");
});
