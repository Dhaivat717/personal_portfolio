import { CONTACT_LIMITS, type ContactFieldName } from "../../src/contact";
import { site } from "../../src/settings";

interface Env {
  RESEND_API_KEY?: string;
  EMAIL_API_URL?: string;
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

type FieldErrors = Partial<Record<ContactFieldName, string>>;
type ErrorReason = "validation" | "verification" | "unavailable";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SITE_HOST = new URL(site.origin).hostname;
const FROM_ADDRESS = `contact@${SITE_HOST}`;
const DEFAULT_EMAIL_API_URL = "https://api.resend.com/emails";
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
  } else if (input.name.length > CONTACT_LIMITS.name) {
    errors.name = `Name must be ${CONTACT_LIMITS.name} characters or fewer.`;
  }

  if (!input.email || !EMAIL_RE.test(input.email) || input.email.length > CONTACT_LIMITS.email) {
    errors.email = "Please enter a valid email address.";
  }

  if (!input.message) {
    errors.message = "Please enter a message.";
  } else if (input.message.length > CONTACT_LIMITS.message) {
    errors.message = `Message must be ${CONTACT_LIMITS.message} characters or fewer.`;
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

async function sendViaResend(opts: {
  apiUrl: string;
  apiKey: string;
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  name: string;
  message: string;
}): Promise<boolean> {
  const res = await fetch(opts.apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${sanitizeHeaderValue(site.name)} Contact <${opts.from}>`,
      to: [opts.to],
      reply_to: opts.replyTo,
      subject: sanitizeHeaderValue(opts.subject),
      text: `Name: ${opts.name}\nEmail: ${opts.replyTo}\n\n${opts.message}\n`,
    }),
  });
  return res.ok;
}

function redirectSeeOther(location: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: location },
  });
}

function respondError(
  json: boolean,
  status: number,
  error: string,
  reason: ErrorReason,
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
  return redirectSeeOther(`/contact/error?reason=${reason}`);
}

function respondSuccess(json: boolean, message: string): Response {
  if (json) {
    return new Response(JSON.stringify({ ok: true, message }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  return redirectSeeOther("/contact/sent");
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const json = wantsJson(request);
  const input = await parseInput(request);
  if (!input) {
    return respondError(json, 400, "Invalid request body.", "validation");
  }

  const errors = validate(input);
  if (Object.keys(errors).length > 0) {
    return respondError(json, 400, "Please fix the highlighted fields.", "validation", errors);
  }

  if (!input.turnstileToken) {
    return respondError(
      json,
      400,
      "Please complete the verification check and try again.",
      "verification",
    );
  }

  if (!env.TURNSTILE_SECRET_KEY || !env.RESEND_API_KEY || !env.CONTACT_TO) {
    return respondError(
      json,
      500,
      "Contact form is temporarily unavailable. Please try again later.",
      "unavailable",
    );
  }

  const verified = await verifyTurnstile(
    env.TURNSTILE_SECRET_KEY,
    input.turnstileToken,
    request.headers.get("CF-Connecting-IP"),
  );
  if (!verified) {
    return respondError(json, 400, "Verification failed. Please try again.", "verification");
  }

  const prefix = env.SITE_ENV === "production" ? "" : "[preview] ";
  const subject = `${prefix}Contact from ${input.name}`;

  try {
    const sent = await sendViaResend({
      apiUrl: env.EMAIL_API_URL || DEFAULT_EMAIL_API_URL,
      apiKey: env.RESEND_API_KEY,
      from: FROM_ADDRESS,
      to: env.CONTACT_TO,
      replyTo: input.email,
      subject,
      name: input.name,
      message: input.message,
    });
    if (!sent) {
      return respondError(
        json,
        502,
        "Could not send your message right now. Please try again later.",
        "unavailable",
      );
    }
  } catch {
    return respondError(
      json,
      502,
      "Could not send your message right now. Please try again later.",
      "unavailable",
    );
  }

  return respondSuccess(json, "Thanks — your message has been sent.");
};
