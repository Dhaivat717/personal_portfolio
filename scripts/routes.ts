import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

export const DEFAULT_DIST_DIR = resolve(import.meta.dirname, "../dist");

/**
 * Normalize a relative HTML file path inside `dist/` into a site route.
 * Handles both `build.format: "file"` (`projects.html` -> `/projects`) and
 * directory-style output (`about/index.html` -> `/about`).
 */
function htmlPathToRoute(relPath: string): string {
  const posix = relPath.replace(/\\/g, "/");
  if (posix === "index.html") return "/";
  if (posix.endsWith("/index.html")) return "/" + posix.slice(0, -"/index.html".length);
  return "/" + posix.slice(0, -".html".length);
}

/**
 * Discover every built HTML page in `distDir` as a sorted list of routes.
 * New routes are picked up automatically from the build output.
 */
export function discoverRoutes(distDir: string = DEFAULT_DIST_DIR): string[] {
  if (!existsSync(distDir)) {
    throw new Error(`Built site directory not found at "${distDir}". Run \`npm run build\` first.`);
  }

  const entries = readdirSync(distDir, { recursive: true, encoding: "utf8" });
  return entries
    .filter((entry) => entry.endsWith(".html"))
    .map(htmlPathToRoute)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Select the routes Lighthouse CI audits: Home, `/projects` (if built), and
 * the first Deep dive (if built).
 */
export function selectLighthouseRoutes(routes: readonly string[]): string[] {
  const selected: string[] = [];
  if (routes.includes("/")) selected.push("/");
  if (routes.includes("/projects")) selected.push("/projects");
  const deepDive = routes.find((route) => /^\/projects\/[^/]+$/.test(route));
  if (deepDive) selected.push(deepDive);
  return selected;
}
