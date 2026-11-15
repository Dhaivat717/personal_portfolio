import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

/**
 * Personal projects: one folder per project, the folder name is the slug.
 * PROJECTS_DIR lets the build tests point the build at fixture content.
 * The schema and content checks arrive with the authoring-workflow ticket.
 */
const projects = defineCollection({
  loader: glob({
    pattern: "*/index.{md,mdx}",
    base: process.env.PROJECTS_DIR ?? "./src/content/projects",
    generateId: ({ entry }) => entry.split("/")[0],
  }),
});

export const collections = { projects };
