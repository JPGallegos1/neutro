import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://neutro.solutions",
  output: "static",
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
