import { describe, expect, it } from "vitest";
import { handleContact, type ContactEnv } from "../../src/api/contact";

const BASE_ENV: ContactEnv = {
  TURNSTILE_SECRET_KEY: "ts_secret_key",
  TURNSTILE_VERIFY_URL: "https://turnstile.test/siteverify",
  RESEND_API_KEY: "re_secret_key",
  EMAIL_API_URL: "https://resend.test/emails",
  CONTACT_TO: "owner@example.invalid",
};

interface RecordedCall {
  url: string;
  init: RequestInit | undefined;
}

function createFakeFetch(
  responder: (url: string, init: RequestInit | undefined) => Response | Promise<Response>,
) {
  const calls: RecordedCall[] = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init });
    return responder(url, init);
  };
  return { fetch: fakeFetch, calls };
}

function jsonRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://example.test/api/contact", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function formRequest(fields: Record<string, string>): Request {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }
  return new Request("https://example.test/api/contact", {
    method: "POST",
    headers: { accept: "text/html" },
    body: form,
  });
}

describe("handleContact", () => {
  it("verifies Turnstile, sends via Resend with [preview] subject outside production, and returns 200 JSON without leaking recipient", async () => {
    const { fetch: fakeFetch, calls } = createFakeFetch((url) => {
      if (url === BASE_ENV.TURNSTILE_VERIFY_URL) {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      if (url === BASE_ENV.EMAIL_API_URL) {
        return new Response(JSON.stringify({ id: "email-123" }), { status: 200 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const req = jsonRequest(
      {
        name: "Ada Lovelace",
        email: "ada@example.test",
        message: "Hello from the portfolio!",
        "cf-turnstile-response": "valid-token",
      },
      { "CF-Connecting-IP": "203.0.113.10" },
    );

    const res = await handleContact(req, BASE_ENV, { fetch: fakeFetch });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");

    const rawText = await res.text();
    expect(rawText).not.toContain("owner@example.invalid");
    expect(rawText).not.toContain("re_secret_key");
    expect(rawText).not.toContain("ts_secret_key");
    const body = JSON.parse(rawText);
    expect(body).toEqual({
      ok: true,
      message: "Thanks, your message has been sent.",
    });

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe("https://turnstile.test/siteverify");
    expect(calls[0].init?.method).toBe("POST");
    const verifyParams = new URLSearchParams(String(calls[0].init?.body));
    expect(verifyParams.get("secret")).toBe("ts_secret_key");
    expect(verifyParams.get("response")).toBe("valid-token");
    expect(verifyParams.get("remoteip")).toBe("203.0.113.10");

    expect(calls[1].url).toBe("https://resend.test/emails");
    expect(calls[1].init?.method).toBe("POST");
    const headers = calls[1].init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_secret_key");
    const emailPayload = JSON.parse(String(calls[1].init?.body));
    expect(emailPayload.to).toEqual(["owner@example.invalid"]);
    expect(emailPayload.reply_to).toBe("ada@example.test");
    expect(emailPayload.subject).toBe("[preview] Contact from Ada Lovelace");
    expect(emailPayload.text).toContain("Hello from the portfolio!");
  });

  it("omits [preview] from the subject in production and strips header-injection newlines", async () => {
    const { fetch: fakeFetch, calls } = createFakeFetch((url) => {
      if (url === BASE_ENV.TURNSTILE_VERIFY_URL) {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ id: "email-prod" }), { status: 200 });
    });

    const req = jsonRequest({
      name: "Grace\r\nBcc: evil@example.test",
      email: "grace@example.test",
      message: "Production message.",
      turnstileToken: "valid-token",
    });

    const res = await handleContact(
      req,
      { ...BASE_ENV, SITE_ENV: "production" },
      { fetch: fakeFetch },
    );
    expect(res.status).toBe(200);

    const emailPayload = JSON.parse(String(calls[1].init?.body));
    expect(emailPayload.subject).toBe("Contact from Grace Bcc: evil@example.test");
    expect(emailPayload.subject).not.toContain("\r");
    expect(emailPayload.subject).not.toContain("\n");
    expect(emailPayload.subject).not.toContain("[preview]");
  });

  it("returns 400 on malformed JSON body without calling external services", async () => {
    const { fetch: fakeFetch, calls } = createFakeFetch(() => {
      throw new Error("Should not call fetch");
    });

    const res = await handleContact(jsonRequest("{not-valid-json"), BASE_ENV, { fetch: fakeFetch });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "Invalid request body." });
    expect(calls).toHaveLength(0);
  });

  it("returns 400 with field-specific errors for invalid or oversized fields", async () => {
    const { fetch: fakeFetch, calls } = createFakeFetch(() => {
      throw new Error("Should not call fetch");
    });

    const emptyRes = await handleContact(
      jsonRequest({
        name: "   ",
        email: "not-an-email",
        message: "",
        "cf-turnstile-response": "valid-token",
      }),
      BASE_ENV,
      { fetch: fakeFetch },
    );
    expect(emptyRes.status).toBe(400);
    const emptyBody = await emptyRes.json();
    expect(emptyBody.ok).toBe(false);
    expect(emptyBody.errors).toEqual({
      name: expect.any(String),
      email: expect.any(String),
      message: expect.any(String),
    });

    const tooLongRes = await handleContact(
      jsonRequest({
        name: "a".repeat(121),
        email: `${"a".repeat(250)}@b.co`,
        message: "m".repeat(5001),
        "cf-turnstile-response": "valid-token",
      }),
      BASE_ENV,
      { fetch: fakeFetch },
    );
    expect(tooLongRes.status).toBe(400);
    const tooLongBody = await tooLongRes.json();
    expect(tooLongBody.errors).toEqual({
      name: expect.stringContaining("120"),
      email: expect.any(String),
      message: expect.stringContaining("5000"),
    });
    expect(calls).toHaveLength(0);
  });

  it("returns 400 when the Turnstile token is missing", async () => {
    const { fetch: fakeFetch, calls } = createFakeFetch(() => {
      throw new Error("Should not call fetch");
    });

    const res = await handleContact(
      jsonRequest({
        name: "Ada Lovelace",
        email: "ada@example.test",
        message: "Hello!",
      }),
      BASE_ENV,
      { fetch: fakeFetch },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/verification/i);
    expect(calls).toHaveLength(0);
  });

  it("returns 500 when required server environment variables are missing", async () => {
    const { fetch: fakeFetch, calls } = createFakeFetch(() => {
      throw new Error("Should not call fetch");
    });

    for (const missingKey of ["TURNSTILE_SECRET_KEY", "RESEND_API_KEY", "CONTACT_TO"] as const) {
      const env = { ...BASE_ENV, [missingKey]: undefined };
      const res = await handleContact(
        jsonRequest({
          name: "Ada Lovelace",
          email: "ada@example.test",
          message: "Hello!",
          "cf-turnstile-response": "valid-token",
        }),
        env,
        { fetch: fakeFetch },
      );
      expect(res.status, `missing ${missingKey}`).toBe(500);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.error).toMatch(/unavailable/i);
    }
    expect(calls).toHaveLength(0);
  });

  it("returns 400 when Turnstile rejects the token and never calls Resend", async () => {
    const { fetch: fakeFetch, calls } = createFakeFetch((url) => {
      if (url === BASE_ENV.TURNSTILE_VERIFY_URL) {
        return new Response(JSON.stringify({ success: false }), { status: 200 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const res = await handleContact(
      jsonRequest({
        name: "Ada Lovelace",
        email: "ada@example.test",
        message: "Should be rejected.",
        "cf-turnstile-response": "bad-token",
      }),
      BASE_ENV,
      { fetch: fakeFetch },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/verification/i);
    expect(calls).toHaveLength(1);
  });

  it("returns 502 when Turnstile fails at the network, HTTP, or JSON layer", async () => {
    const failureResponders: Array<[string, () => Response | Promise<Response>]> = [
      ["network error", () => Promise.reject(new Error("ECONNREFUSED"))],
      ["non-OK status", () => new Response("Service Unavailable", { status: 503 })],
      ["malformed JSON", () => new Response("<html>oops</html>", { status: 200 })],
      ["null JSON body", () => new Response("null", { status: 200 })],
    ];

    for (const [label, responder] of failureResponders) {
      const { fetch: fakeFetch, calls } = createFakeFetch(responder);
      const res = await handleContact(
        jsonRequest({
          name: "Ada Lovelace",
          email: "ada@example.test",
          message: "Hello!",
          "cf-turnstile-response": "valid-token",
        }),
        BASE_ENV,
        { fetch: fakeFetch },
      );
      expect(res.status, label).toBe(502);
      const text = await res.text();
      expect(text, label).not.toContain("ts_secret_key");
      expect(JSON.parse(text).ok, label).toBe(false);
      expect(calls).toHaveLength(1);
    }
  });

  it("returns 502 when Resend returns an error status or throws a network error", async () => {
    const resendFailures: Array<[string, () => Response | Promise<Response>]> = [
      ["non-OK status", () => new Response(JSON.stringify({ message: "bad key" }), { status: 500 })],
      ["network error", () => Promise.reject(new Error("socket hang up"))],
    ];

    for (const [label, resendResponder] of resendFailures) {
      const { fetch: fakeFetch } = createFakeFetch((url) => {
        if (url === BASE_ENV.TURNSTILE_VERIFY_URL) {
          return new Response(JSON.stringify({ success: true }), { status: 200 });
        }
        return resendResponder();
      });

      const res = await handleContact(
        jsonRequest({
          name: "Ada Lovelace",
          email: "ada@example.test",
          message: "Hello!",
          "cf-turnstile-response": "valid-token",
        }),
        BASE_ENV,
        { fetch: fakeFetch },
      );
      expect(res.status, label).toBe(502);
      const text = await res.text();
      expect(text).not.toContain("re_secret_key");
      expect(JSON.parse(text).ok).toBe(false);
    }
  });

  it("issues 303 See Other redirects for plain HTML form submissions", async () => {
    const { fetch: okFetch } = createFakeFetch((url) => {
      if (url === BASE_ENV.TURNSTILE_VERIFY_URL) {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ id: "email-html" }), { status: 200 });
    });

    const sentRes = await handleContact(
      formRequest({
        name: "Ada Lovelace",
        email: "ada@example.test",
        message: "Plain form post!",
        "cf-turnstile-response": "valid-token",
      }),
      BASE_ENV,
      { fetch: okFetch },
    );
    expect(sentRes.status).toBe(303);
    expect(sentRes.headers.get("location")).toBe("/contact/sent");

    const invalidRes = await handleContact(
      formRequest({ name: "", email: "bad", message: "" }),
      BASE_ENV,
      { fetch: okFetch },
    );
    expect(invalidRes.status).toBe(303);
    expect(invalidRes.headers.get("location")).toBe("/contact/error?reason=validation");

    const noTokenRes = await handleContact(
      formRequest({ name: "Ada", email: "ada@example.test", message: "No JS" }),
      BASE_ENV,
      { fetch: okFetch },
    );
    expect(noTokenRes.status).toBe(303);
    expect(noTokenRes.headers.get("location")).toBe("/contact/error?reason=verification");

    const { fetch: failFetch } = createFakeFetch(() => Promise.reject(new Error("down")));
    const unavailableRes = await handleContact(
      formRequest({
        name: "Ada",
        email: "ada@example.test",
        message: "Down",
        "cf-turnstile-response": "valid-token",
      }),
      BASE_ENV,
      { fetch: failFetch },
    );
    expect(unavailableRes.status).toBe(303);
    expect(unavailableRes.headers.get("location")).toBe("/contact/error?reason=unavailable");
  });
});
