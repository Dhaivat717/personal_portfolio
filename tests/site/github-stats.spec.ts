import { expect, test } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close(() => reject(new Error("Could not allocate port")));
        return;
      }
      const { port } = addr;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

async function startWrangler(bindings: Record<string, string>): Promise<{
  baseUrl: string;
  stop: () => Promise<void>;
}> {
  const port = await freePort();
  const inspectorPort = await freePort();
  const stateDir = await mkdtemp(join(tmpdir(), "wrangler-gh-stats-"));
  const args = [
    "wrangler",
    "pages",
    "dev",
    "dist",
    "--port",
    String(port),
    "--inspector-port",
    String(inspectorPort),
    "--persist-to",
    stateDir,
  ];
  for (const [k, v] of Object.entries(bindings)) {
    args.push("--binding", `${k}=${v}`);
  }

  let output = "";
  const child: ChildProcess = spawn("npx", args, {
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (d) => {
    output += d.toString();
  });
  child.stderr?.on("data", (d) => {
    output += d.toString();
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`wrangler exited early (${child.exitCode}):\n${output}`);
    }
    try {
      const res = await fetch(baseUrl);
      if (res.ok) break;
    } catch {
      // still starting
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  return {
    baseUrl,
    stop: async () => {
      if (child.exitCode === null) {
        child.kill("SIGTERM");
        await new Promise((r) => setTimeout(r, 300));
        if (child.exitCode === null) child.kill("SIGKILL");
      }
      await rm(stateDir, { recursive: true, force: true });
    },
  };
}

test.describe("GET /api/github-stats", () => {
  test("fetches contribution-graph total from GitHub GraphQL API, returns JSON with 1-hour edge cache header, and never leaks GITHUB_TOKEN", async () => {
    const res = await fetch("http://127.0.0.1:8788/api/github-stats");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");

    const cacheControl = res.headers.get("cache-control") ?? "";
    expect(cacheControl).toContain("max-age=3600");

    const rawText = await res.text();
    expect(rawText).not.toContain("ghp_");
    expect(rawText).not.toContain("github_pat_");
    const body = JSON.parse(rawText);
    expect(body).toEqual({ contributions: 30 });

    const capturedRes = await fetch("http://127.0.0.1:8789/graphql/captured");
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

    type Mode = "success" | "error" | "malformed" | "missingField" | "timeout";
    let mode: Mode = "success";
    const stub = await startGitHubStub((_req, res) => {
      if (mode === "success") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            data: {
              user: {
                contributionsCollection: {
                  contributionCalendar: {
                    totalContributions: 845,
                  },
                },
              },
            },
          }),
        );
      } else if (mode === "error") {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ message: "Internal Server Error" }));
      } else if (mode === "malformed") {
        res.writeHead(200, { "content-type": "text/html" });
        res.end("<html>not json</html>");
      } else if (mode === "missingField") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ errors: [{ message: "Bad credentials" }] }));
      }
      // For "timeout", intentionally never respond.
    });
    const srv = await startWrangler({
      GITHUB_TOKEN: secretToken,
      GITHUB_API_URL: stub.url,
      GITHUB_TIMEOUT_MS: "200",
    });
    try {
      // Custom stub value (845) returned with secret token verified and never leaked
      const okRes = await fetch(`${srv.baseUrl}/api/github-stats`);
      expect(okRes.status).toBe(200);
      const okText = await okRes.text();
      expect(okText).not.toContain(secretToken);
      expect(JSON.parse(okText)).toEqual({ contributions: 845 });

      for (const currentMode of ["error", "malformed", "missingField", "timeout"] as const) {
        mode = currentMode;
        const res = await fetch(`${srv.baseUrl}/api/github-stats`);
        expect(res.ok, `mode=${currentMode}`).toBe(false);
        expect(res.status, `mode=${currentMode}`).toBe(502);
        const text = await res.text();
        expect(text).not.toContain(secretToken);
      }
    } finally {
      await srv.stop();
      await stub.stop();
    }
  });

  test("Home page fetches /api/github-stats after load and swaps the number in place with no layout shift", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Hold the /api/github-stats response briefly so we can measure the baked state first,
    // then fulfill via the real Pages Function with a distinct contribution total (845).
    let releaseResponse!: () => void;
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    await page.route("**/api/github-stats", async (route) => {
      await responseGate;
      const response = await route.fetch();
      const json = (await response.json()) as { contributions: number };
      expect(json).toEqual({ contributions: 30 });
      await route.fulfill({
        response,
        body: JSON.stringify({ contributions: 845 }),
      });
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

  test("Home page keeps the baked number with no spinner, blank box, or layout shift when /api/github-stats fails", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.route("**/api/github-stats", async (route) => {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "GitHub API returned an error." }),
      });
    });

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
