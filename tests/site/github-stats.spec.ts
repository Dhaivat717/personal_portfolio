import { expect, test } from "@playwright/test";
import http from "node:http";
import { startWrangler } from "./wrangler-helper";

interface CapturedGraphQLRequest {
  method: string | undefined;
  authorization: string | undefined;
  body: {
    query?: string;
    variables?: Record<string, unknown>;
  };
}

type StubHandler = (req: http.IncomingMessage, res: http.ServerResponse, rawBody: string) => void;

async function startGitHubStub(handler: StubHandler): Promise<{
  url: string;
  captured: CapturedGraphQLRequest[];
  stop: () => Promise<void>;
}> {
  const captured: CapturedGraphQLRequest[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      let parsed: CapturedGraphQLRequest["body"] = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        // non-JSON request body
      }
      captured.push({
        method: req.method,
        authorization: req.headers.authorization,
        body: parsed,
      });
      handler(req, res, raw);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("Could not bind GitHub stub");
  return {
    url: `http://127.0.0.1:${addr.port}/graphql`,
    captured,
    stop: () =>
      new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
  };
}

const STUB_PORT = Number(process.env.PLAYWRIGHT_EMAIL_PORT ?? Number(process.env.PLAYWRIGHT_PORT ?? 8788) + 1);
const STUB_BASE = `http://127.0.0.1:${STUB_PORT}`;

async function configureSharedGraphqlStub(config: {
  mode: "ok" | "error" | "malformed" | "missingField";
  contributions?: number;
}) {
  await fetch(`${STUB_BASE}/graphql/config`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(config),
  });
}

test.describe("GET /api/github-stats", () => {
  test.describe.configure({ mode: "serial" });

  test.afterEach(async () => {
    await configureSharedGraphqlStub({ mode: "ok", contributions: 30 });
  });

  test("fetches contribution-graph total from GitHub GraphQL API, returns JSON with 1-hour edge cache header, and never leaks GITHUB_TOKEN", async () => {
    await configureSharedGraphqlStub({ mode: "ok", contributions: 412 });

    const res = await fetch("http://127.0.0.1:8788/api/github-stats");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");

    const cacheControl = res.headers.get("cache-control") ?? "";
    expect(cacheControl).toContain("max-age=3600");

    const rawText = await res.text();
    expect(rawText).not.toContain("ghp_");
    expect(rawText).not.toContain("github_pat_");
    const body = JSON.parse(rawText);
    expect(body).toEqual({ contributions: 412 });

    const capturedRes = await fetch(`${STUB_BASE}/graphql/captured`);
    const captured = (await capturedRes.json()) as Array<{
      method?: string;
      authorization?: string;
      body?: { query?: string; variables?: { login?: string } };
    }>;
    expect(captured.length).toBeGreaterThanOrEqual(1);
    const last = captured[captured.length - 1];
    expect(last.method).toBe("POST");
    expect(last.authorization).toMatch(/^Bearer \S+$/);
    expect(last.body?.query).toContain("totalContributions");
    expect(last.body?.variables?.login).toBe("Dhaivat717");
  });

  test("fails cleanly on missing GITHUB_TOKEN, upstream error status, malformed JSON, missing field, or upstream timeout without leaking secrets", async () => {
    const secretToken = "ghp_secret_for_error_cases_999";

    // 1. Upstream error status (500), malformed body, and missing field via the shared stub server
    for (const currentMode of ["error", "malformed", "missingField"] as const) {
      await configureSharedGraphqlStub({ mode: currentMode });
      const res = await fetch("http://127.0.0.1:8788/api/github-stats");
      expect(res.ok, `mode=${currentMode}`).toBe(false);
      expect(res.status, `mode=${currentMode}`).toBe(502);
      const text = await res.text();
      expect(text).not.toContain("ghp_");
    }

    // 2. Missing GITHUB_TOKEN (using an isolated Wrangler instance with an empty env file) and upstream timeout
    let shouldHang = false;
    const stub = await startGitHubStub((_req, res) => {
      if (!shouldHang) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ data: {} }));
      }
      // When shouldHang is true, intentionally never respond to trigger GITHUB_TIMEOUT_MS.
    });

    const srvNoToken = await startWrangler({
      GITHUB_TOKEN: "   ",
      GITHUB_API_URL: stub.url,
    });
    try {
      const noTokenRes = await fetch(`${srvNoToken.baseUrl}/api/github-stats`);
      expect(noTokenRes.ok).toBe(false);
      expect(noTokenRes.status).toBe(503);
      expect(stub.captured).toHaveLength(0);
    } finally {
      await srvNoToken.stop();
    }

    shouldHang = true;
    const srvTimeout = await startWrangler({
      GITHUB_TOKEN: secretToken,
      GITHUB_API_URL: stub.url,
      GITHUB_TIMEOUT_MS: "200",
    });
    try {
      const timeoutRes = await fetch(`${srvTimeout.baseUrl}/api/github-stats`);
      expect(timeoutRes.ok).toBe(false);
      expect(timeoutRes.status).toBe(502);
      const text = await timeoutRes.text();
      expect(text).not.toContain(secretToken);
    } finally {
      await srvTimeout.stop();
      await stub.stop();
    }
  });

  test("Home page fetches /api/github-stats after load and swaps the number from the stub GitHub server in place with no layout shift", async ({
    page,
  }) => {
    await configureSharedGraphqlStub({ mode: "ok", contributions: 845 });
    await page.setViewportSize({ width: 1280, height: 800 });

    // Hold the browser's /api/github-stats request briefly so we can measure the baked state first,
    // then let it continue untouched to the Pages Function backed by the stub GitHub server.
    let releaseResponse!: () => void;
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    await page.route("**/api/github-stats", async (route) => {
      await responseGate;
      await route.continue();
    });

    await page.goto("/");
    const ghStatLink = page.getByRole("link", { name: /GitHub contributions/ });
    const ghStatNum = page.locator("[data-github-contributions]");

    await expect(ghStatNum).toHaveText("30");
    const boxBefore = (await ghStatLink.boundingBox())!;

    releaseResponse();

    await expect(ghStatNum).toHaveText("845");
    const boxAfter = (await ghStatLink.boundingBox())!;
    expect(boxAfter.width).toBe(boxBefore.width);
    expect(boxAfter.height).toBe(boxBefore.height);
    expect(boxAfter.x).toBe(boxBefore.x);
    expect(boxAfter.y).toBe(boxBefore.y);

    expect(await page.content()).not.toContain("ghp_");
    expect(await page.content()).not.toContain("github_pat_");
  });

  test("Home page keeps the baked number with no spinner, blank box, or layout shift when the stub GitHub server fails", async ({
    page,
  }) => {
    await configureSharedGraphqlStub({ mode: "error" });
    await page.setViewportSize({ width: 1280, height: 800 });

    const statsRespPromise = page.waitForResponse((r) =>
      r.url().endsWith("/api/github-stats"),
    );
    await page.goto("/");

    const ghStatLink = page.getByRole("link", { name: /GitHub contributions/ });
    const ghStatNum = page.locator("[data-github-contributions]");
    const boxBefore = (await ghStatLink.boundingBox())!;

    const statsResp = await statsRespPromise;
    expect(statsResp.status()).toBe(502);

    // Give any client handler a tick to settle after the failed response.
    await page.waitForTimeout(100);

    await expect(ghStatNum).toHaveText("30");
    const boxAfter = (await ghStatLink.boundingBox())!;
    expect(boxAfter.width).toBe(boxBefore.width);
    expect(boxAfter.height).toBe(boxBefore.height);
    expect(boxAfter.x).toBe(boxBefore.x);
    expect(boxAfter.y).toBe(boxBefore.y);
  });
});
