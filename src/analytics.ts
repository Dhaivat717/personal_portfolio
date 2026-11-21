export type OutboundTarget = "github" | "linkedin" | "itch" | "code-repo" | "email";

interface UmamiWindow extends Window {
  umami?: {
    track?: (event: string, data?: Record<string, string>) => void;
  };
}

/**
 * Send a custom event to Umami when it is loaded (production only).
 * Harmless no-op in previews, local dev, and when blocked.
 */
export function trackEvent(event: string, data?: Record<string, string>): void {
  const track = (window as UmamiWindow).umami?.track;
  if (!track) return;
  if (data) {
    track(event, data);
  } else {
    track(event);
  }
}

/**
 * Classify an anchor element into an outbound-click `target` value.
 * Prefers an explicit `data-outbound-target` attribute (e.g. `code-repo` on a
 * Deep dive's GitHub link) and falls back to URL host/scheme classification.
 */
export function classifyOutboundTarget(link: HTMLAnchorElement): OutboundTarget | null {
  const explicit = link.dataset.outboundTarget as OutboundTarget | undefined;
  if (explicit) return explicit;

  const rawHref = link.getAttribute("href");
  if (!rawHref) return null;
  if (rawHref.startsWith("mailto:")) return "email";

  let url: URL;
  try {
    url = new URL(rawHref, window.location.origin);
  } catch {
    return null;
  }
  if (url.origin === window.location.origin) return null;

  const host = url.hostname.toLowerCase();
  if (host === "github.com" || host.endsWith(".github.com")) return "github";
  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return "linkedin";
  if (host === "itch.io" || host.endsWith(".itch.io")) return "itch";
  return null;
}
