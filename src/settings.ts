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
} as const;
