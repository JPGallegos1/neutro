export type ExcepcionAxe = {
  id: string;
  razon: string;
};

export const excepcionesAxe: ExcepcionAxe[] = [];

export const etiquetasAxe = ["wcag2a", "wcag2aa", "wcag21aa"] as const;

export const temas = [
  { nombre: "claro", valor: "light" },
  { nombre: "oscuro", valor: "dark" },
] as const;

export const viewports = [
  { nombre: "escritorio", width: 1280, height: 720 },
  { nombre: "movil", width: 390, height: 844 },
] as const;
