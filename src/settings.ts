/**
 * Site settings: the one source for who Dhaivat is and where the site lives.
 * Pages, metadata and (later) JSON-LD and social cards read from here, so a
 * change of role or employer is a one-line edit in this file.
 */
export const site = {
  name: "Dhaivat Patel",
  role: "Software Engineer",
  employer: "Amazon Ads",
  yearsOfExperience: "5+",
  alumniOf: "Rutgers University",
  /** Path on `origin` for the Person JSON-LD image (updated when the portrait/card lands). */
  image: "/og/home.png",
  social: {
    github: "https://github.com/Dhaivat717",
    linkedin: "https://www.linkedin.com/in/dhaivat-h-patel/",
  },
  /** Canonical origin, no trailing slash. */
  origin: "https://dhaivat.dev",
  /**
   * Turnstile site key (public). This is Cloudflare's always-pass test key
   * until the production widget is created (launch checklist step 5).
   */
  turnstileSiteKey: "1x00000000000000000000AA",
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
