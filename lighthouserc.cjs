const { existsSync, readdirSync } = require("node:fs");
const { resolve } = require("node:path");

const PORT = 8788;
const ORIGIN = `http://localhost:${PORT}`;
const DIST_DIR = resolve(__dirname, "dist");

function htmlPathToRoute(relPath) {
  const posix = relPath.replace(/\\/g, "/");
  if (posix === "index.html") return "/";
  if (posix.endsWith("/index.html")) return "/" + posix.slice(0, -"/index.html".length);
  return "/" + posix.slice(0, -".html".length);
}

function discoverLighthouseUrls() {
  if (!existsSync(DIST_DIR)) {
    return [`${ORIGIN}/`];
  }
  const routes = readdirSync(DIST_DIR, { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith(".html"))
    .map(htmlPathToRoute)
    .sort((a, b) => a.localeCompare(b));

  const selected = [];
  if (routes.includes("/")) selected.push("/");
  if (routes.includes("/projects")) selected.push("/projects");
  const deepDive = routes.find((route) => /^\/projects\/[^/]+$/.test(route));
  if (deepDive) selected.push(deepDive);

  return selected.map((route) => `${ORIGIN}${route}`);
}

module.exports = {
  ci: {
    collect: {
      url: discoverLighthouseUrls(),
      numberOfRuns: 1,
      startServerCommand: `npx wrangler pages dev dist --port ${PORT}`,
      startServerReadyPattern: "Ready on",
      startServerReadyTimeout: 30000,
      settings: {
        chromeFlags: "--no-sandbox --disable-gpu",
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 1 }],
        "categories:best-practices": ["error", { minScore: 1 }],
        "categories:seo": ["error", { minScore: 1 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci",
    },
  },
};
