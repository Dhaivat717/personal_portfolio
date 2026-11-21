import { expect, test } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { site } from "../../src/settings";

const ALWAYS_PASS_SECRET = "1x0000000000000000000000000000000AA";
const ALWAYS_FAIL_SECRET = "2x0000000000000000000000000000000AA";

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
  logs: () => string;
  stop: () => Promise<void>;
}> {
  const port = await freePort();
  const inspectorPort = await freePort();
  const stateDir = await mkdtemp(join(tmpdir(), "wrangler-contact-"));
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
    logs: () => output,
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

async function waitForCapturedEmail(logs: () => string): Promise<string> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    // Strip ANSI escape codes from wrangler logs before matching the .eml path.
    const clean = logs().replace(/\x1b\[[0-9;]*m/g, "");
    const match = clean.match(/Email:\s+(\S+\.eml)/);
    if (match?.[1]) {
      return readFile(match[1], "utf8");
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`No captured .eml file found in wrangler logs:\n${logs()}`);
}

test.describe("Contact form", () => {
  test("renders in #contact with visible labels, Turnstile widget, and no email address", async ({
    page,
  }) => {
    await page.goto("/");
    const section = page.locator("#contact");
    await expect(section.getByRole("heading", { level: 2 })).toBeVisible();

    const name = section.getByLabel("Name");
    const email = section.getByLabel("Email");
    const message = section.getByLabel("Message");
    await expect(name).toBeVisible();
    await expect(email).toBeVisible();
    await expect(message).toBeVisible();
    await expect(section.getByRole("button", { name: /send/i })).toBeVisible();

    const turnstile = section.locator(".cf-turnstile");
    await expect(turnstile).toHaveAttribute("data-sitekey", site.turnstileSiteKey);

    expect(await page.content()).not.toMatch(/mailto:|[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  });

  test("POST /api/contact returns field-specific JSON errors for invalid fields", async ({
    request,
  }) => {
    const res = await request.post("/api/contact", {
      headers: { Accept: "application/json" },
      data: {
        name: "   ",
        email: "not-an-email",
        message: "",
        "cf-turnstile-response": "XXXX.DUMMY.TOKEN.XXXX",
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.errors).toEqual({
      name: expect.any(String),
      email: expect.any(String),
      message: expect.any(String),
    });
  });

  test("always-pass Turnstile key sends via send_email with [preview] subject outside production", async () => {
    const recipient = "owner-preview@example.invalid";
    const srv = await startWrangler({
      TURNSTILE_SECRET_KEY: ALWAYS_PASS_SECRET,
      CONTACT_TO: recipient,
    });
    try {
      const res = await fetch(`${srv.baseUrl}/api/contact`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          name: "Ada Lovelace",
          email: "ada@example.test",
          message: "Hello from the preview test!",
          "cf-turnstile-response": "XXXX.DUMMY.TOKEN.XXXX",
        }),
      });
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).not.toContain(recipient);
      const body = JSON.parse(text);
      expect(body.ok).toBe(true);

      const eml = await waitForCapturedEmail(srv.logs);
      expect(eml).toContain(`To: ${recipient}`);
      expect(eml).toContain("Reply-To: ada@example.test");
      expect(eml).toMatch(/^Subject: \[preview\] .*Ada Lovelace/m);
      expect(eml).toContain("Hello from the preview test!");
    } finally {
      await srv.stop();
    }
  });

  test("SITE_ENV=production omits [preview] from the email subject", async () => {
    const recipient = "owner-prod@example.invalid";
    const srv = await startWrangler({
      TURNSTILE_SECRET_KEY: ALWAYS_PASS_SECRET,
      CONTACT_TO: recipient,
      SITE_ENV: "production",
    });
    try {
      const res = await fetch(`${srv.baseUrl}/api/contact`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          name: "Grace Hopper",
          email: "grace@example.test",
          message: "Production message.",
          "cf-turnstile-response": "XXXX.DUMMY.TOKEN.XXXX",
        }),
      });
      expect(res.status).toBe(200);

      const eml = await waitForCapturedEmail(srv.logs);
      expect(eml).toMatch(/^Subject: Contact from Grace Hopper/m);
      expect(eml).not.toContain("[preview]");
    } finally {
      await srv.stop();
    }
  });

  test("always-fail Turnstile key rejects the submission", async () => {
    const srv = await startWrangler({
      TURNSTILE_SECRET_KEY: ALWAYS_FAIL_SECRET,
      CONTACT_TO: "owner-fail@example.invalid",
    });
    try {
      const res = await fetch(`${srv.baseUrl}/api/contact`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          name: "Ada Lovelace",
          email: "ada@example.test",
          message: "Should be rejected by Turnstile.",
          "cf-turnstile-response": "XXXX.DUMMY.TOKEN.XXXX",
        }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.error).toMatch(/verification/i);
    } finally {
      await srv.stop();
    }
  });

  test("in the browser, invalid fields show errors linked via aria-describedby and announced in a live region", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as unknown as { __events: string[]; umami: { track: (e: string) => void } }).__events =
        [];
      (window as unknown as { __events: string[]; umami: { track: (e: string) => void } }).umami = {
        track(e: string) {
          (window as unknown as { __events: string[] }).__events.push(e);
        },
      };
    });

    await page.goto("/");
    const section = page.locator("#contact");
    await section.getByLabel("Email").fill("not-an-email");
    await section.getByRole("button", { name: /send/i }).click();

    const status = section.getByRole("status");
    await expect(status).toContainText(/fix|error/i);

    for (const label of ["Name", "Email", "Message"]) {
      const input = section.getByLabel(label);
      await expect(input).toHaveAttribute("aria-invalid", "true");
      const describedBy = await input.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      const errEl = page.locator(`#${describedBy}`);
      await expect(errEl).toBeVisible();
      await expect(errEl).not.toHaveText("");
    }

    const events = await page.evaluate(
      () => (window as unknown as { __events: string[] }).__events,
    );
    expect(events).toEqual([]);
  });

  test("in the browser, valid submission sends via fetch, announces success, and fires contact-sent", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as unknown as { __events: string[]; umami: { track: (e: string) => void } }).__events =
        [];
      (window as unknown as { __events: string[]; umami: { track: (e: string) => void } }).umami = {
        track(e: string) {
          (window as unknown as { __events: string[] }).__events.push(e);
        },
      };
    });

    await page.goto("/");
    const section = page.locator("#contact");

    // Wait for Cloudflare Turnstile's always-pass test widget to populate its hidden token.
    const tokenInput = section.locator('input[name="cf-turnstile-response"]');
    await expect(tokenInput).toHaveValue(/.+/, { timeout: 15_000 });

    await section.getByLabel("Name").fill("Ada Lovelace");
    await section.getByLabel("Email").fill("ada@example.test");
    await section.getByLabel("Message").fill("Hello from Playwright!");
    await section.getByRole("button", { name: /send/i }).click();

    const status = section.getByRole("status");
    await expect(status).toContainText(/sent/i);
    await expect(section.getByLabel("Name")).toHaveValue("");

    const events = await page.evaluate(
      () => (window as unknown as { __events: string[] }).__events,
    );
    expect(events).toEqual(["contact-sent"]);
  });

  test("with JS disabled, submitting the form redirects to /contact/error with verification guidance", async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    try {
      await page.goto("/");
      const section = page.locator("#contact");
      await section.getByLabel("Name").fill("Ada Lovelace");
      await section.getByLabel("Email").fill("ada@example.test");
      await section.getByLabel("Message").fill("Hello without JS!");

      const [postResponse] = await Promise.all([
        page.waitForResponse((r) => r.url().endsWith("/api/contact") && r.request().method() === "POST"),
        section.getByRole("button", { name: /send/i }).click(),
      ]);

      expect(postResponse.status()).toBe(303);
      expect(postResponse.headers()["location"]).toBe("/contact/error?reason=verification");

      await expect(page).toHaveURL(/\/contact\/error(?:\?reason=verification)?$/);
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Message not sent.");
      await expect(page.locator("main")).toContainText(/javascript|verification/i);
      await expect(page.getByRole("link", { name: /back/i })).toHaveAttribute("href", "/#contact");
    } finally {
      await context.close();
    }
  });

  test("plain HTML form POST with valid token redirects 303 to /contact/sent", async ({
    request,
  }) => {
    const res = await request.post("/api/contact", {
      headers: { Accept: "text/html" },
      maxRedirects: 0,
      form: {
        name: "Ada Lovelace",
        email: "ada@example.test",
        message: "Plain form post!",
        "cf-turnstile-response": "XXXX.DUMMY.TOKEN.XXXX",
      },
    });
    expect(res.status()).toBe(303);
    expect(res.headers()["location"]).toBe("/contact/sent");

    const sentRes = await request.get("/contact/sent");
    expect(sentRes.status()).toBe(200);
    expect(sentRes.headers()["content-type"]).toContain("text/html");
    const html = await sentRes.text();
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).toContain("Message sent.");
    expect(html).toContain('href="/#contact"');
    expect(html).not.toContain("test-recipient@example.invalid");
  });

  test("plain HTML form POST with invalid fields redirects 303 to /contact/error?reason=validation", async ({
    request,
  }) => {
    const res = await request.post("/api/contact", {
      headers: { Accept: "text/html" },
      maxRedirects: 0,
      form: {
        name: "",
        email: "not-an-email",
        message: "",
      },
    });
    expect(res.status()).toBe(303);
    expect(res.headers()["location"]).toBe("/contact/error?reason=validation");
  });
});
