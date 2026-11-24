/**
 * Shared contact form field names, length limits, and copy, imported by
 * `ContactForm.astro`, `src/pages/contact/sent.astro`, and
 * `functions/api/contact.ts`.
 */
export const CONTACT_FIELDS = ["name", "email", "message"] as const;
export type ContactFieldName = (typeof CONTACT_FIELDS)[number];

export const CONTACT_LIMITS = {
  name: 120,
  email: 254,
  message: 5000,
} as const satisfies Record<ContactFieldName, number>;

export const CONTACT_SUCCESS_MESSAGE = "Thanks, your message has been sent.";
