import { expect, test } from "@playwright/test";
import { site } from "../../src/settings";

const TURNSTILE_WIDGET_STUB = `
  window.turnstile = { reset() {} };
  for (const el of document.querySelectorAll(".cf-turnstile")) {
    let input = el.querySelector('input[name="cf-turnstile-response"]');
    if (!input) {
      input = document.createElement("input");
      input.type = "hidden";
      input.name = "cf-turnstile-response";
      el.appendChild(input);
    }
    input.value = "stub-turnstile-token";
  }
`;

test.describe("Contact form", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/javascript; charset=utf-8",
        body: TURNSTILE_WIDGET_STUB,
      }),
    );
  });

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
        "cf-turnstile-response": "stub-turnstile-token",
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
    await section.scrollIntoViewIfNeeded();

    const tokenInput = section.locator('input[name="cf-turnstile-response"]');
    await expect(tokenInput).toHaveValue("stub-turnstile-token");

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
        "cf-turnstile-response": "stub-turnstile-token",
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
    expect(html).not.toContain("—");
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
