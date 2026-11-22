import { spawn } from "node:child_process";

const port = Number(process.argv[2] ?? 8788);
const stubPort = Number(process.argv[3] ?? port + 1);

const stub = spawn(process.execPath, ["tests/site/email-stub.mjs", String(stubPort)], {
  stdio: "inherit",
});

const wrangler = spawn(
  "npx",
  [
    "wrangler",
    "pages",
    "dev",
    "dist",
    "--port",
    String(port),
    "--binding",
    "GITHUB_TOKEN=ghp_test_token",
    "--binding",
    `GITHUB_API_URL=http://127.0.0.1:${stubPort}/graphql`,
  ],
  { stdio: "inherit" },
);

function shutdown(signal) {
  if (wrangler.exitCode === null) wrangler.kill(signal);
  if (stub.exitCode === null) stub.kill(signal);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

wrangler.on("exit", (code) => {
  if (stub.exitCode === null) stub.kill("SIGTERM");
  process.exit(code ?? 0);
});
stub.on("exit", (code) => {
  if (code && wrangler.exitCode === null) {
    wrangler.kill("SIGTERM");
    process.exit(code);
  }
});
