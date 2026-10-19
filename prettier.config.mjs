export default {
  plugins: ["prettier-plugin-astro", "prettier-plugin-tailwindcss"],
  tailwindStylesheet: "./packages/ui/src/styles/globals.css",
  tailwindFunctions: ["cn", "cva"],
  overrides: [{ files: "*.astro", options: { parser: "astro" } }],
};
