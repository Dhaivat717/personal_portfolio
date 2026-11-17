import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";

/**
 * The Deep dive's Architecture section in a built page: from its h2 up to the
 * next h2. The spine check has already made sure both exist, in order.
 */
function architectureSection(html: string): string | null {
  return html.match(/<h2 id="architecture"[\s\S]*?(?=<h2[\s>])/)?.[0] ?? null;
}

/**
 * Fails the build when a Deep dive's Architecture section has no diagram from
 * the diagram kit. It reads the built pages, so it checks what Visitors get,
 * whether the diagram is written inline in the MDX or in its own file.
 */
export function architectureDiagramCheck(): AstroIntegration {
  return {
    name: "architecture-diagram-check",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        const projectsDir = join(fileURLToPath(dir), "projects");
        const files = await readdir(projectsDir).catch(() => [] as string[]);
        const missing: string[] = [];
        for (const file of files.filter((f) => f.endsWith(".html")).sort()) {
          const section = architectureSection(await readFile(join(projectsDir, file), "utf8"));
          if (section !== null && !/<figure[^>]*\sdata-diagram[\s>]/.test(section)) missing.push(file.replace(/\.html$/, ""));
        }
        if (missing.length > 0) {
          throw new Error(
            missing.map((id) => `Personal project "${id}" has no diagram in its Architecture section.`).join(" ") +
              " Every Deep dive's Architecture section opens with a diagram built from the diagram kit" +
              " (src/components/diagram), followed by its walk-through.",
          );
        }
      },
    },
  };
}
