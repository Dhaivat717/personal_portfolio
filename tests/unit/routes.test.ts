import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { discoverRoutes, selectLighthouseRoutes } from "../../scripts/routes.ts";

const tempDirs: string[] = [];

function makeDist(files: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "portfolio-routes-"));
  tempDirs.push(dir);
  for (const rel of files) {
    const full = join(dir, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, "<!doctype html><html></html>");
  }
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("discoverRoutes", () => {
  test("discovers every built HTML page as a normalized route and ignores non-HTML assets", () => {
    const dist = makeDist([
      "index.html",
      "projects.html",
      "projects/whatsapp-auto-wish-bot.html",
      "projects/spider.html",
      "404.html",
      "about/index.html",
      "_astro/nav.js",
      "fonts/inter-latin.woff2",
    ]);

    expect(discoverRoutes(dist)).toEqual([
      "/",
      "/404",
      "/about",
      "/projects",
      "/projects/spider",
      "/projects/whatsapp-auto-wish-bot",
    ]);
  });

  test("throws a clear error when dist has not been built", () => {
    expect(() => discoverRoutes(join(tmpdir(), "does-not-exist-portfolio-dist"))).toThrow(/build/i);
  });
});

describe("selectLighthouseRoutes", () => {
  test("selects Home, /projects, and the first Deep dive when all exist", () => {
    expect(
      selectLighthouseRoutes([
        "/",
        "/404",
        "/projects",
        "/projects/alpha",
        "/projects/beta",
      ]),
    ).toEqual(["/", "/projects", "/projects/alpha"]);
  });

  test("skips /projects and Deep dive when they do not exist yet", () => {
    expect(selectLighthouseRoutes(["/", "/404"])).toEqual(["/"]);
    expect(selectLighthouseRoutes(["/", "/404", "/projects"])).toEqual(["/", "/projects"]);
  });
});
