// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import { site } from "./src/settings.ts";

export default defineConfig({
  site: site.origin,
  output: "static",
  trailingSlash: "never",
  build: { format: "file" },
  integrations: [mdx(), react()],
});
