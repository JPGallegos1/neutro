import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, colorScheme: "light" });

async function openDrawer(page: Page) {
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.locator("[data-drawer]").evaluate(async (dialog) => {
    await Promise.allSettled(
      dialog.getAnimations().map((item) => item.finished),
    );
  });
}

async function expectClosed(page: Page) {
  await expect(page.locator("[data-drawer]")).not.toHaveAttribute("open", "");
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await expect(
    page.getByRole("button", { name: "Abrir menú" }),
  ).toHaveAttribute("aria-expanded", "false");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test.afterEach(async ({ page }) => {
  expect(await page.pageErrors()).toEqual([]);
});

test("la salida conserva modalidad y scroll hasta devolver el foco", async ({
  page,
}) => {
  await openDrawer(page);
  const snapshot = await page.locator("[data-drawer]").evaluate(async (el) => {
    const dialog = el as HTMLDialogElement;
    const closed = new Promise<void>((resolve) =>
      dialog.addEventListener("close", () => resolve(), { once: true }),
    );
    dialog
      .querySelector<HTMLButtonElement>("[data-drawer-close]")!
      .dispatchEvent(new MouseEvent("click", { detail: 1, bubbles: true }));
    const fading = dialog
      .getAnimations()
      .find(
        (item): item is CSSTransition =>
          item instanceof CSSTransition &&
          item.transitionProperty === "opacity",
      );
    if (!fading)
      throw new Error("El cierre debe tener una transición de opacidad");
    fading.pause();
    fading.currentTime = 80;
    const style = getComputedStyle(dialog);
    const state = {
      open: dialog.open,
      modal: dialog.matches(":modal"),
      locked: document.body.style.overflow,
      expanded: document
        .querySelector("[data-drawer-open]")!
        .getAttribute("aria-expanded"),
      opacity: Number(style.opacity),
      duration: fading.effect!.getTiming().duration,
      easing: fading.effect!.getTiming().easing,
    };
    fading.finish();
    await closed;
    return state;
  });
  expect(snapshot).toMatchObject({
    open: true,
    modal: true,
    locked: "hidden",
    expanded: "true",
    duration: 160,
    easing: "cubic-bezier(0.23, 1, 0.32, 1)",
  });
  expect(snapshot.opacity).toBeGreaterThan(0);
  expect(snapshot.opacity).toBeLessThan(1);
  await expectClosed(page);
  await expect(page.getByRole("button", { name: "Abrir menú" })).toBeFocused();
});

test("cerrar durante la entrada y repetir el clic no reinicia el movimiento", async ({
  page,
}) => {
  const result = await page.locator("[data-drawer]").evaluate(async (el) => {
    const dialog = el as HTMLDialogElement;
    document
      .querySelector("[data-drawer-open]")!
      .dispatchEvent(new MouseEvent("click", { detail: 1 }));
    const opening = dialog.getAnimations();
    for (const animation of opening) {
      animation.pause();
      animation.currentTime = 80;
    }
    const before = Number(getComputedStyle(dialog).opacity);
    const close = dialog.querySelector<HTMLButtonElement>(
      "[data-drawer-close]",
    )!;
    close.dispatchEvent(new MouseEvent("click", { detail: 1, bubbles: true }));
    const fading = dialog
      .getAnimations()
      .find(
        (item): item is CSSTransition =>
          item instanceof CSSTransition &&
          item.transitionProperty === "opacity",
      );
    if (!fading) throw new Error("Falta la transición de salida interrumpida");
    const after = Number(getComputedStyle(dialog).opacity);
    close.dispatchEvent(new MouseEvent("click", { detail: 2, bubbles: true }));
    const sameTransition = dialog.getAnimations().includes(fading);
    await Promise.allSettled(
      dialog.getAnimations().map((item) => item.finished),
    );
    return { before, after, sameTransition, opening: opening.length };
  });
  expect(result.opening).toBe(2);
  expect(result.before).toBeGreaterThan(0);
  expect(result.before).toBeLessThan(1);
  expect(result.after).toBeCloseTo(result.before, 2);
  expect(result.sameTransition).toBe(true);
  await expectClosed(page);
});

test("Escape cancela una salida y no deja un cierre viejo sobre la próxima apertura", async ({
  page,
}) => {
  await openDrawer(page);
  await page.clock.install();
  await page.getByRole("button", { name: "Cerrar menú" }).click();
  await page.keyboard.press("Escape");
  await expectClosed(page);
  await page.getByRole("button", { name: "Abrir menú" }).focus();
  await page.keyboard.press("Enter");
  await page.clock.runFor(250);
  await expect(page.getByRole("dialog", { name: "Menú" })).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await expect(page.locator("[data-drawer]")).not.toHaveAttribute(
    "data-closing",
  );
});

for (const key of ["Enter", "Space"]) {
  test(`abrir y cerrar con ${key} es inmediato`, async ({ page }) => {
    await page.getByRole("button", { name: "Abrir menú" }).focus();
    await page.keyboard.press(key);
    const state = await page.locator("[data-drawer]").evaluate((dialog) => ({
      opacity: getComputedStyle(dialog).opacity,
      animations: dialog.getAnimations().length,
    }));
    expect(state).toEqual({ opacity: "1", animations: 0 });
    await page.getByRole("button", { name: "Cerrar menú" }).focus();
    await page.keyboard.press(key);
    await expectClosed(page);
    await expect(
      page.getByRole("button", { name: "Abrir menú" }),
    ).toBeFocused();
  });
}

test("los enlaces cierran sin esperar la salida", async ({ page }) => {
  await openDrawer(page);
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Servicios", exact: true })
    .click();
  await expect(page).toHaveURL(/\/#que-hacemos$/);
  await expectClosed(page);
});

test("el cambio a desktop durante la salida devuelve el foco a un control visible", async ({
  page,
}) => {
  await openDrawer(page);
  await page.getByRole("button", { name: "Cerrar menú" }).click();
  await page.setViewportSize({ width: 1024, height: 844 });
  await expect(page.locator("[data-drawer]")).not.toHaveAttribute("open", "");
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await expect(page.locator("header a.logo")).toBeFocused();
  await expect(page.locator("header a.logo")).toBeVisible();
});

test("movimiento reducido conserva solo el fade de 100 ms", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const entry = await page.locator("[data-drawer]").evaluate(async (dialog) => {
    document
      .querySelector("[data-drawer-open]")!
      .dispatchEvent(new MouseEvent("click", { detail: 1 }));
    const animations = dialog.getAnimations();
    const state = {
      transform: getComputedStyle(dialog).transform,
      durations: animations.map((item) => item.effect!.getTiming().duration),
      properties: animations.map(
        (item) => (item as CSSTransition).transitionProperty,
      ),
    };
    await Promise.allSettled(animations.map((item) => item.finished));
    return state;
  });
  expect(entry).toEqual({
    transform: "none",
    durations: [100],
    properties: ["opacity"],
  });
  const exit = await page.locator("[data-drawer]").evaluate(async (dialog) => {
    dialog
      .querySelector("[data-drawer-close]")!
      .dispatchEvent(new MouseEvent("click", { detail: 1, bubbles: true }));
    const animations = dialog.getAnimations();
    const state = {
      transform: getComputedStyle(dialog).transform,
      durations: animations.map((item) => item.effect!.getTiming().duration),
      properties: animations.map(
        (item) => (item as CSSTransition).transitionProperty,
      ),
    };
    await Promise.allSettled(animations.map((item) => item.finished));
    return state;
  });
  expect(exit).toEqual({
    transform: "none",
    durations: [100],
    properties: ["opacity"],
  });
  await expectClosed(page);
  await page.getByRole("button", { name: "Abrir menú" }).focus();
  await page.keyboard.press("Enter");
  expect(
    await page
      .locator("[data-drawer]")
      .evaluate((el) => el.getAnimations().length),
  ).toBe(0);
});
