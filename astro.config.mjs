// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { architectureDiagramCheck } from "./src/architectureCheck.ts";
import { site } from "./src/settings.ts";

export default defineConfig({
  site: site.origin,
  output: "static",
  trailingSlash: "never",
  build: { format: "file" },
  // Code excerpts in Deep dives render as dark blocks in both themes.
  markdown: { shikiConfig: { theme: "github-dark" } },
  integrations: [
    mdx(),
    react(),
    sitemap({
      filter: (page) => !new URL(page).pathname.startsWith("/contact/"),
    }),
    architectureDiagramCheck(),
  ],
});
