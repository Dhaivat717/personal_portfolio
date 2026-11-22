import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { OG_HEIGHT, OG_WIDTH } from "./og.ts";
import { site } from "./settings.ts";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function htmlPathToRoute(relPath: string): string {
  const posix = relPath.replace(/\\/g, "/");
  if (posix === "index.html") return "/";
  if (posix.endsWith("/index.html")) return "/" + posix.slice(0, -"/index.html".length);
  return "/" + posix.slice(0, -".html".length);
}

function isNoindex(html: string): boolean {
  return /<meta\b[^>]*\bname=["']robots["'][^>]*\bcontent=["'][^"']*\bnoindex\b/i.test(html);
}

function extractOgImage(html: string): string | null {
  const match =
    html.match(/<meta\b[^>]*\bproperty=["']og:image["'][^>]*\bcontent=["']([^"']+)["']/i) ??
    html.match(/<meta\b[^>]*\bcontent=["']([^"']+)["'][^>]*\bproperty=["']og:image["']/i);
  return match?.[1] ?? null;
}

function readPngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/**
 * Fails the build when any indexable page has no social preview card or points
 * to a card that wasn't built as a 1200×630 PNG.
 *
 * `FIXTURE_PAGE` lets the Seam 1 build tests inject a single fixture `.astro`
 * route at `/fixture-page` without modifying `src/pages/`.
 */
export function socialCardCheck(): AstroIntegration {
  return {
    name: "social-card-check",
    hooks: {
      "astro:config:setup": ({ injectRoute }) => {
        if (process.env.FIXTURE_PAGE) {
          injectRoute({ pattern: "/fixture-page", entrypoint: process.env.FIXTURE_PAGE });
        }
      },
      "astro:build:done": async ({ dir }) => {
        const distDir = fileURLToPath(dir);
        const entries = await readdir(distDir, { recursive: true, encoding: "utf8" });
        const htmlFiles = entries.filter((entry) => entry.endsWith(".html")).sort();
        const errors: string[] = [];

        for (const relPath of htmlFiles) {
          const html = await readFile(join(distDir, relPath), "utf8");
          if (isNoindex(html)) continue;

          const route = htmlPathToRoute(relPath);
          const ogImage = extractOgImage(html);
          if (!ogImage) {
            errors.push(
              `Page "${route}" has no social card (missing og:image meta tag). Pass ogImage to Base.astro and generate its ${OG_WIDTH}×${OG_HEIGHT} PNG in src/og.ts and src/pages/og/[...page].png.ts (or pass noindex if it is a utility page).`,
            );
            continue;
          }

          let cardPath: string;
          try {
            const parsed = new URL(ogImage, site.origin);
            if (parsed.origin !== site.origin) {
              errors.push(`Page "${route}" has og:image "${ogImage}" outside ${site.origin}.`);
              continue;
            }
            cardPath = parsed.pathname;
          } catch {
            errors.push(`Page "${route}" has invalid og:image URL "${ogImage}".`);
            continue;
          }

          const filePath = join(distDir, cardPath.replace(/^\/+/, ""));
          let buf: Buffer;
          try {
            buf = await readFile(filePath);
          } catch {
            errors.push(
              `Page "${route}" points og:image to "${cardPath}", but that social card PNG was not built.`,
            );
            continue;
          }

          const dims = readPngDimensions(buf);
          if (!dims || dims.width !== OG_WIDTH || dims.height !== OG_HEIGHT) {
            const actual = dims ? `${dims.width}×${dims.height}` : "not a valid PNG";
            errors.push(
              `Page "${route}" social card "${cardPath}" must be a ${OG_WIDTH}×${OG_HEIGHT} PNG (found ${actual}).`,
            );
          }
        }

        if (errors.length > 0) {
          throw new Error(errors.join(" "));
        }
      },
    },
  };
}
