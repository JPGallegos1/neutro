import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://neutro.solutions",
  output: "static",
  trailingSlash: "never",
  build: {
    format: "file",
  },
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
