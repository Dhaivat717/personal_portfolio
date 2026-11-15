import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");

export interface BuildResult {
  status: number | null;
  /** stdout and stderr together, as the owner would read them in CI. */
  output: string;
}

/**
 * Seam 1: run the production build against a fixture content directory
 * (`tests/build/fixtures/<name>`) and report its exit status and output.
 */
export function buildWithFixture(fixture: string, env: Record<string, string> = {}): BuildResult {
  const outDir = mkdtempSync(join(tmpdir(), "portfolio-build-"));
  try {
    const res = spawnSync("npx", ["astro", "build", "--outDir", outDir], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        SITE_ENV: "production",
        SHOW_DRAFTS: "false",
        ...env,
        PROJECTS_DIR: resolve(root, "tests/build/fixtures", fixture),
        NO_COLOR: "1",
      },
    });
    return { status: res.status, output: `${res.stdout}\n${res.stderr}` };
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}
