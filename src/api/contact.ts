import { CONTACT_LIMITS, CONTACT_SUCCESS_MESSAGE, type ContactFieldName } from "../contact";
import { site } from "../settings";

export interface ContactEnv {
  RESEND_API_KEY?: string;
  EMAIL_API_URL?: string;
  CONTACT_TO?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_VERIFY_URL?: string;
  SITE_ENV?: string;
}

export interface ContactDeps {
  fetch?: typeof fetch;
}

interface ContactInput {
  name: string;
  email: string;
  message: string;
  turnstileToken: string;
}

type FieldErrors = Partial<Record<ContactFieldName, string>>;
type ErrorReason = "validation" | "verification" | "unavailable";
type TurnstileResult = "verified" | "rejected" | "unavailable";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SITE_HOST = new URL(site.origin).hostname;
const FROM_ADDRESS = `contact@${SITE_HOST}`;
const DEFAULT_EMAIL_API_URL = "https://api.resend.com/emails";
const DEFAULT_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

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
  fetchImpl: typeof fetch,
  verifyUrl: string,
  secret: string,
  token: string,
  remoteIp: string | null,
): Promise<TurnstileResult> {
  const params = new URLSearchParams({ secret, response: token });
  if (remoteIp) params.set("remoteip", remoteIp);

  let res: Response;
  try {
    res = await fetchImpl(verifyUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  } catch {
    return "unavailable";
  }

  if (!res.ok) return "unavailable";

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return "unavailable";
  }

  if (!data || typeof data !== "object") return "unavailable";
  return (data as { success?: unknown }).success === true ? "verified" : "rejected";
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

async function sendViaResend(
  fetchImpl: typeof fetch,
  opts: {
    apiUrl: string;
    apiKey: string;
    from: string;
    to: string;
    replyTo: string;
    subject: string;
    name: string;
    message: string;
  },
): Promise<boolean> {
  const res = await fetchImpl(opts.apiUrl, {
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

export async function handleContact(
  request: Request,
  env: ContactEnv,
  deps: ContactDeps = {},
): Promise<Response> {
  const fetchImpl = deps.fetch ?? globalThis.fetch;
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

  const verifyUrl = env.TURNSTILE_VERIFY_URL?.trim() || DEFAULT_SITEVERIFY_URL;
  const verification = await verifyTurnstile(
    fetchImpl,
    verifyUrl,
    env.TURNSTILE_SECRET_KEY,
    input.turnstileToken,
    request.headers.get("CF-Connecting-IP"),
  );
  if (verification === "unavailable") {
    return respondError(
      json,
      502,
      "Could not verify your submission right now. Please try again later.",
      "unavailable",
    );
  }
  if (verification === "rejected") {
    return respondError(json, 400, "Verification failed. Please try again.", "verification");
  }

  const prefix = env.SITE_ENV === "production" ? "" : "[preview] ";
  const subject = `${prefix}Contact from ${input.name}`;

  let sent = false;
  try {
    sent = await sendViaResend(fetchImpl, {
      apiUrl: env.EMAIL_API_URL?.trim() || DEFAULT_EMAIL_API_URL,
      apiKey: env.RESEND_API_KEY,
      from: FROM_ADDRESS,
      to: env.CONTACT_TO,
      replyTo: input.email,
      subject,
      name: input.name,
      message: input.message,
    });
  } catch {
    sent = false;
  }

  if (!sent) {
    return respondError(
      json,
      502,
      "Could not send your message right now. Please try again later.",
      "unavailable",
    );
  }

  return respondSuccess(json, CONTACT_SUCCESS_MESSAGE);
}
