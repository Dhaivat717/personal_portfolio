import { EmailMessage } from "cloudflare:email";

interface Env {
  SEND_EMAIL?: SendEmail;
  CONTACT_TO?: string;
  TURNSTILE_SECRET_KEY?: string;
  SITE_ENV?: string;
}

interface ContactInput {
  name: string;
  email: string;
  message: string;
  turnstileToken: string;
}

type FieldName = "name" | "email" | "message";
type FieldErrors = Partial<Record<FieldName, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_MESSAGE = 5000;
const FROM_ADDRESS = "contact@dhaivat.dev";
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function wantsJson(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";
  return accept.includes("application/json") || contentType.includes("application/json");
}

async function parseInput(request: Request): Promise<ContactInput | null> {
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      return {
        name: typeof body.name === "string" ? body.name.trim() : "",
        email: typeof body.email === "string" ? body.email.trim() : "",
        message: typeof body.message === "string" ? body.message.trim() : "",
        turnstileToken:
          typeof body["cf-turnstile-response"] === "string"
            ? body["cf-turnstile-response"].trim()
            : typeof body.turnstileToken === "string"
              ? body.turnstileToken.trim()
              : "",
      };
    }

    const form = await request.formData();
    const str = (key: string) => {
      const val = form.get(key);
      return typeof val === "string" ? val.trim() : "";
    };
    return {
      name: str("name"),
      email: str("email"),
      message: str("message"),
      turnstileToken: str("cf-turnstile-response"),
    };
  } catch {
    return null;
  }
}

function validate(input: ContactInput): FieldErrors {
  const errors: FieldErrors = {};

  if (!input.name) {
    errors.name = "Please enter your name.";
  } else if (input.name.length > MAX_NAME) {
    errors.name = `Name must be ${MAX_NAME} characters or fewer.`;
  }

  if (!input.email || !EMAIL_RE.test(input.email) || input.email.length > MAX_EMAIL) {
    errors.email = "Please enter a valid email address.";
  }

  if (!input.message) {
    errors.message = "Please enter a message.";
  } else if (input.message.length > MAX_MESSAGE) {
    errors.message = `Message must be ${MAX_MESSAGE} characters or fewer.`;
  }

  return errors;
}

async function verifyTurnstile(
  secret: string,
  token: string,
  remoteIp: string | null,
): Promise<boolean> {
  const params = new URLSearchParams({ secret, response: token });
  if (remoteIp) params.set("remoteip", remoteIp);

  const res = await fetch(SITEVERIFY_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function buildMimeMessage(opts: {
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  name: string;
  message: string;
}): string {
  const messageId = `<${crypto.randomUUID()}@dhaivat.dev>`;
  const headers = [
    `From: Dhaivat.dev Contact <${opts.from}>`,
    `To: ${sanitizeHeaderValue(opts.to)}`,
    `Reply-To: ${sanitizeHeaderValue(opts.replyTo)}`,
    `Subject: ${sanitizeHeaderValue(opts.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
  ];
  const body = `Name: ${opts.name}\nEmail: ${opts.replyTo}\n\n${opts.message}\n`;
  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function htmlResultPage(opts: {
  title: string;
  heading: string;
  message: string;
  errors?: FieldErrors;
  status: number;
}): Response {
  const errorList = opts.errors
    ? `<ul>${Object.values(opts.errors)
        .filter((v): v is string => Boolean(v))
        .map((msg) => `<li>${escapeHtml(msg)}</li>`)
        .join("")}</ul>`
    : "";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${escapeHtml(opts.title)} · Dhaivat Patel</title>
    <style>
      :root {
        color-scheme: light dark;
        --bg: light-dark(#fff, #000);
        --fg: light-dark(#1d1d1f, #f5f5f7);
        --fg-strong: light-dark(#000, #fff);
        --muted: light-dark(#6e6e73, #a1a1a6);
        --accent: light-dark(#c2410c, #ff8a3d);
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: var(--bg);
        color: var(--fg);
        line-height: 1.55;
      }
      main {
        max-width: 520px;
        width: 100%;
      }
      h1 {
        margin: 0 0 12px;
        font-size: clamp(28px, 4vw, 40px);
        letter-spacing: -0.03em;
        color: var(--fg-strong);
      }
      p {
        margin: 0 0 18px;
        color: var(--muted);
      }
      ul {
        margin: 0 0 20px;
        padding-left: 20px;
        color: var(--accent);
      }
      a {
        color: var(--accent);
        font-weight: 600;
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
      a:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(opts.heading)}</h1>
      <p>${escapeHtml(opts.message)}</p>
      ${errorList}
      <p><a href="/#contact">← Back to contact form</a></p>
    </main>
  </body>
</html>`;

  return new Response(html, {
    status: opts.status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function respondError(
  json: boolean,
  status: number,
  error: string,
  errors?: FieldErrors,
): Response {
  if (json) {
    return new Response(
      JSON.stringify(errors ? { ok: false, error, errors } : { ok: false, error }),
      {
        status,
        headers: { "content-type": "application/json; charset=utf-8" },
      },
    );
  }
  return htmlResultPage({
    title: "Message not sent",
    heading: "Message not sent.",
    message: error,
    errors,
    status,
  });
}

function respondSuccess(json: boolean, message: string): Response {
  if (json) {
    return new Response(JSON.stringify({ ok: true, message }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  return htmlResultPage({
    title: "Message sent",
    heading: "Message sent.",
    message,
    status: 200,
  });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const json = wantsJson(request);
  const input = await parseInput(request);
  if (!input) {
    return respondError(json, 400, "Invalid request body.");
  }

  const errors = validate(input);
  if (Object.keys(errors).length > 0) {
    return respondError(json, 400, "Please fix the highlighted fields.", errors);
  }

  if (!input.turnstileToken) {
    return respondError(
      json,
      400,
      "Please complete the verification check and try again.",
    );
  }

  if (!env.TURNSTILE_SECRET_KEY || !env.SEND_EMAIL || !env.CONTACT_TO) {
    return respondError(
      json,
      500,
      "Contact form is temporarily unavailable. Please try again later.",
    );
  }

  const verified = await verifyTurnstile(
    env.TURNSTILE_SECRET_KEY,
    input.turnstileToken,
    request.headers.get("CF-Connecting-IP"),
  );
  if (!verified) {
    return respondError(json, 400, "Verification failed. Please try again.");
  }

  const prefix = env.SITE_ENV === "production" ? "" : "[preview] ";
  const subject = `${prefix}Contact from ${input.name}`;
  const raw = buildMimeMessage({
    from: FROM_ADDRESS,
    to: env.CONTACT_TO,
    replyTo: input.email,
    subject,
    name: input.name,
    message: input.message,
  });

  try {
    await env.SEND_EMAIL.send(new EmailMessage(FROM_ADDRESS, env.CONTACT_TO, raw));
  } catch {
    return respondError(
      json,
      502,
      "Could not send your message right now. Please try again later.",
    );
  }

  return respondSuccess(json, "Thanks — your message has been sent.");
};
