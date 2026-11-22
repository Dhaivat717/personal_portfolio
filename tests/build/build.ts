import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");

export interface BuildResult {
  status: number | null;
  /** stdout and stderr together, as the owner would read them in CI. */
  output: string;
  /** The built HTML for a route such as `/projects`, or null if it wasn't built. */
  page(route: string): string | null;
  /** A built text file by relative path (e.g. `sitemap-0.xml`, `robots.txt`, `_headers`), or null if absent. */
  file(path: string): string | null;
  /** A built binary file by relative path (e.g. `og/home.png`), or null if absent. */
  binary(path: string): Buffer | null;
}

export interface BuildOptions {
  /**
   * Environment overrides. A value of `undefined` unsets the variable.
   * By default the build runs as CI does: SHOW_DRAFTS=false, SITE_ENV unset.
   */
  env?: Record<string, string | undefined>;
}

/**
 * Seam 1: run the production build against a fixture content directory
 * (`tests/build/fixtures/<name>`, with its clips in that folder's `public/<slug>/`)
 * and report its exit status, output and pages.
 */
export function buildWithFixture(fixture: string, { env = {} }: BuildOptions = {}): BuildResult {
  const outDir = mkdtempSync(join(tmpdir(), "portfolio-build-"));
  try {
    const envWithUnsets: Record<string, string | undefined> = {
      ...process.env,
      // As CI builds: drafts off. SITE_ENV=production is reserved for the
      // Pages Production environment (it also turns on analytics).
      SHOW_DRAFTS: "false",
      SITE_ENV: undefined,
      ...env,
      PROJECTS_DIR: resolve(root, "tests/build/fixtures", fixture),
      // A fixture's clips live in its own public folder, under each project's slug.
      PUBLIC_DIR: resolve(root, "tests/build/fixtures", fixture, "public"),
      NO_COLOR: "1",
    };
    const childEnv = Object.fromEntries(
      Object.entries(envWithUnsets).filter((entry): entry is [string, string] => entry[1] !== undefined),
    );
    const res = spawnSync("npx", ["astro", "build", "--outDir", outDir], {
      cwd: root,
      encoding: "utf8",
      env: childEnv,
    });

    // Read the built pages, text metadata files and social card PNGs now; the temp folder is deleted on return.
    const pages = new Map<string, string>();
    const files = new Map<string, string>();
    const binaries = new Map<string, Buffer>();
    for (const file of readdirSync(outDir, { recursive: true, encoding: "utf8" })) {
      const normalized = file.replace(/\\/g, "/");
      if (normalized.endsWith(".html")) {
        const route = `/${normalized.replace(/(index)?\.html$/, "")}`.replace(/(.)\/$/, "$1");
        pages.set(route, readFileSync(join(outDir, file), "utf8"));
      } else if (normalized.endsWith(".xml") || normalized.endsWith(".txt") || normalized === "_headers") {
        files.set(normalized, readFileSync(join(outDir, file), "utf8"));
      } else if (normalized.startsWith("og/") && normalized.endsWith(".png")) {
        binaries.set(normalized, readFileSync(join(outDir, file)));
      }
    }

    return {
      status: res.status,
      output: `${res.stdout}\n${res.stderr}`,
      page: (route) => pages.get(route) ?? null,
      file: (path) => files.get(path.replace(/^\/+/, "")) ?? null,
      binary: (path) => binaries.get(path.replace(/^\/+/, "")) ?? null,
    };
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}
