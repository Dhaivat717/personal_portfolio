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
 * (`tests/build/fixtures/<name>`) and report its exit status, output and pages.
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

    // Read the built pages now; the temp folder is deleted on return.
    const pages = new Map<string, string>();
    for (const file of readdirSync(outDir, { recursive: true, encoding: "utf8" })) {
      if (!file.endsWith(".html")) continue;
      const route = `/${file.replace(/\\/g, "/").replace(/(index)?\.html$/, "")}`.replace(/(.)\/$/, "$1");
      pages.set(route, readFileSync(join(outDir, file), "utf8"));
    }

    return {
      status: res.status,
      output: `${res.stdout}\n${res.stderr}`,
      page: (route) => pages.get(route) ?? null,
    };
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}
