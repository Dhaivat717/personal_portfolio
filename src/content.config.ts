import { defineCollection } from "astro:content";
import { glob, type Loader } from "astro/loaders";
import { z } from "astro/zod";
import { isIconName, notAnIconMessage } from "./icons";
import { checkProjectMedia, isClipName, type StoredMedia } from "./media";

/**
 * Wraps a loader so every entry's media files (frontmatter media and images
 * the body imports) are checked, existing and under their size caps, after
 * each load. The checks run over the whole
 * store, not per parsed entry, because unchanged entries come from Astro's
 * cache without being parsed again, and a media file can change on its own.
 */
function withMediaChecks(loader: Loader): Loader {
  return {
    ...loader,
    load: async (context) => {
      await loader.load(context);
      for (const entry of context.store.values()) {
        const media = entry.data.media as StoredMedia;
        checkProjectMedia(entry.id, entry.filePath ?? "", media, entry.body ?? "");
      }
    },
  };
}

/**
 * Personal projects: one folder per project, the folder name is the slug.
 * PROJECTS_DIR lets the build tests point the build at fixture content.
 */
const projects = defineCollection({
  loader: withMediaChecks(
    glob({
      pattern: "*/index.{md,mdx}",
      base: process.env.PROJECTS_DIR ?? "./src/content/projects",
      generateId: ({ entry }) => entry.split("/")[0],
    }),
  ),
  schema: ({ image }) => z.strictObject({
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
    // A clip (MP4/WebM, in public/<slug>/) or an image next to the MDX.
    media: z.strictObject({
      src: z.union([z.string().refine(isClipName), image()]),
      poster: image().optional(),
      caption: z.string().trim().min(1),
      alt: z.string().trim().min(1),
    }),
    draft: z.boolean().optional(),
  }),
});

export const collections = { projects };
