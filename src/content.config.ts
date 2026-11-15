import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { isIconName, notAnIconMessage } from "./icons";

/**
 * Personal projects: one folder per project, the folder name is the slug.
 * PROJECTS_DIR lets the build tests point the build at fixture content.
 */
const projects = defineCollection({
  loader: glob({
    pattern: "*/index.{md,mdx}",
    base: process.env.PROJECTS_DIR ?? "./src/content/projects",
    generateId: ({ entry }) => entry.split("/")[0],
  }),
  schema: z.strictObject({
    title: z.string().min(1),
    pitch: z.string().min(1).max(120, "pitch must be at most 120 characters"),
    when: z.string().min(1),
    stack: z.array(z.string().min(1)),
    builtOn: z.strictObject({ name: z.string().min(1), author: z.string().min(1), url: z.url() }).optional(),
    links: z.strictObject({
      code: z.url(),
      play: z.array(z.strictObject({ label: z.string().min(1), url: z.url() })).optional(),
    }),
    order: z.number(),
    featured: z.boolean(),
    icon: z.string().refine(isIconName, { error: (issue) => notAnIconMessage(String(issue.input)) }),
    media: z.strictObject({
      src: z.string().min(1),
      poster: z.string().min(1).optional(),
      caption: z.string().min(1),
      alt: z.string().min(1),
    }),
    draft: z.boolean().optional(),
  }),
});

export const collections = { projects };
