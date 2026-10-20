const STORAGE_KEY = "neutro-theme";

export type Theme = "light" | "dark";

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(stored: string | null): Theme {
  if (stored === "light" || stored === "dark") return stored;
  return systemPrefersDark() ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function readStoredTheme(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function persistTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Sin cookies ni storage: la preferencia del sistema sigue aplicando.
  }
}

export function syncThemeControls(theme: Theme): void {
  document
    .querySelectorAll<HTMLButtonElement>("[data-theme-toggle]")
    .forEach((btn) => {
      btn.setAttribute(
        "aria-label",
        theme === "dark" ? "Activar tema claro" : "Activar tema oscuro",
      );
    });

  document
    .querySelectorAll<HTMLButtonElement>("[data-theme-set]")
    .forEach((btn) => {
      const value = btn.dataset.themeSet;
      btn.setAttribute("aria-pressed", value === theme ? "true" : "false");
    });
}

export function initThemeControls(): void {
  const current = resolveTheme(readStoredTheme());
  applyTheme(current);
  syncThemeControls(current);

  document
    .querySelectorAll<HTMLButtonElement>("[data-theme-toggle]")
    .forEach((btn) => {
      if (btn.dataset.bound === "true") return;
      btn.dataset.bound = "true";
      btn.addEventListener("click", () => {
        const next: Theme = document.documentElement.classList.contains("dark")
          ? "light"
          : "dark";
        persistTheme(next);
        applyTheme(next);
        syncThemeControls(next);
      });
    });

  document
    .querySelectorAll<HTMLButtonElement>("[data-theme-set]")
    .forEach((btn) => {
      if (btn.dataset.bound === "true") return;
      btn.dataset.bound = "true";
      btn.addEventListener("click", () => {
        const next = btn.dataset.themeSet === "dark" ? "dark" : "light";
        persistTheme(next);
        applyTheme(next);
        syncThemeControls(next);
      });
    });
}
