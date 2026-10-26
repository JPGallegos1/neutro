import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

const site = "https://neutro.solutions";

const legalPaths = ["/cookies", "/privacidad", "/terminos", "/alerta-estafa"];

const trabajoCasePaths = [
  "/trabajo/conexion-laboral",
  "/trabajo/afectiva",
  "/trabajo/capa-automotores",
  "/trabajo/suplementacion-ciencia",
  "/trabajo/luxurycars",
];

export default defineConfig({
  site,
  output: "static",
  trailingSlash: "never",
  build: {
    format: "file",
  },
  integrations: [
    react(),
    sitemap({
      filter(page) {
        const pathname = new URL(page).pathname.replace(/\/+$/, "") || "/";
        return pathname !== "/404";
      },
      customPages: [...legalPaths, ...trabajoCasePaths].map(
        (path) => new URL(path, site).href,
      ),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
