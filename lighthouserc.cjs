const { existsSync } = require("node:fs");
const { DEFAULT_DIST_DIR, discoverRoutes, selectLighthouseRoutes } = require("./scripts/routes.ts");

const PORT = 8788;
const STUB_PORT = PORT + 1;
const ORIGIN = `http://localhost:${PORT}`;

function discoverLighthouseUrls() {
  if (!existsSync(DEFAULT_DIST_DIR)) {
    return [`${ORIGIN}/`];
  }
  return selectLighthouseRoutes(discoverRoutes(DEFAULT_DIST_DIR)).map(
    (route) => `${ORIGIN}${route}`,
  );
}

module.exports = {
  ci: {
    collect: {
      url: discoverLighthouseUrls(),
      numberOfRuns: 3,
      startServerCommand: `node scripts/lighthouse-server.mjs ${PORT} ${STUB_PORT}`,
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
