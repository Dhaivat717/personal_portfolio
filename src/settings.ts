/**
 * Site settings: the one source for who Dhaivat is and where the site lives.
 * Pages, metadata and (later) JSON-LD and social cards read from here, so a
 * change of role or employer is a one-line edit in this file.
 */
export const site = {
  name: "Dhaivat Patel",
  alternateNames: ["Dhaivat", "Dhaivat H. Patel"],
  role: "Software Engineer",
  employer: "Amazon Ads",
  parentEmployer: "Amazon",
  location: "New York City",
  yearsOfExperience: "5+",
  alumniOf: "Rutgers University",
  knowsAbout: [
    "Software Development",
    "Distributed Systems",
    "Backend Engineering",
    "Public APIs",
    "AI Agents",
  ],
  /**
   * Baked-in GitHub contributions count (last 12 months); fixed locally and in
   * CI, and overridable at build time via `GITHUB_CONTRIBUTIONS`.
   */
  githubContributions: Number.parseInt(process.env.GITHUB_CONTRIBUTIONS ?? "", 10) || 30,
  /** Path on `origin` for the Person JSON-LD image (updated when the portrait/card lands). */
  image: "/og/home.png",
  social: {
    github: "https://github.com/Dhaivat717",
    linkedin: "https://www.linkedin.com/in/dhaivat-h-patel/",
  },
  /** Canonical origin, no trailing slash. */
  origin: "https://dhaivat.dev",
  /** Shared Schema.org `@id` IRIs referenced across pages' JSON-LD graphs. */
  jsonLdIds: {
    website: "https://dhaivat.dev/#website",
    person: "https://dhaivat.dev/#person",
  },
  /**
   * Turnstile site key (public): explicit `TURNSTILE_SITE_KEY` override when
   * set, otherwise the production key on Cloudflare Pages (`CF_PAGES=1`) or
   * `SITE_ENV=production`, and Cloudflare's always-pass test key in local dev
   * and CI where the site runs on `localhost` against the test secret.
   */
  turnstileSiteKey:
    process.env.TURNSTILE_SITE_KEY?.trim() ||
    (process.env.SITE_ENV === "production" || process.env.CF_PAGES === "1"
      ? "0x4AAAAAAGMNv4OkZcEnpc7M"
      : "1x00000000000000000000AA"),
  /**
   * Public analytics identifiers (launch checklist step 4). Scripts render only
   * when `SITE_ENV=production`; `UMAMI_WEBSITE_ID` and `CF_WEB_ANALYTICS_TOKEN`
   * env vars override these at build time when set.
   */
  analytics: {
    umamiSrc: "https://cloud.umami.is/script.js",
    umamiWebsiteId: "00000000-0000-0000-0000-000000000000",
    cloudflareBeaconSrc: "https://static.cloudflareinsights.com/beacon.min.js",
    cloudflareBeaconToken: "00000000000000000000000000000000",
  },
} as const;
