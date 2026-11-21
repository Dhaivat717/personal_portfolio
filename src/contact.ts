/**
 * Shared contact form field names and length limits, imported by both
 * `ContactForm.astro` (HTML attributes + client handler) and
 * `functions/api/contact.ts` (server-side validation).
 */
export const CONTACT_FIELDS = ["name", "email", "message"] as const;
export type ContactFieldName = (typeof CONTACT_FIELDS)[number];

export const CONTACT_LIMITS = {
  name: 120,
  email: 254,
  message: 5000,
} as const satisfies Record<ContactFieldName, number>;
