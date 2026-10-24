/**
 * The brand name. Change it here and nowhere else: the UI, page titles,
 * product names (src/config/products.ts), the Convex seed and Remi's prompt all
 * read from this file. Production deploys
 * re-run the seed, so the stored app name and Remi's prompt follow it.
 */
export const BRAND_NAME = "Warpwork";

/**
 * The voice companion's name, used in its prompt, its first words on every call
 * and the UI. Like the brand, it may change before launch, so never hard-code it.
 */
export const ASSISTANT_NAME = "Remi";

/**
 * What we call Remi in words people see and hear, instead of "AI". Keep it
 * plain enough for a child and professional enough for a parent paying for it.
 * Change it here and every page, email and call follows.
 */
export const ASSISTANT_KIND = "voice companion";

/**
 * How Remi says it isn't a person, on every page that introduces it and at the
 * start of every call. The law requires callers to know a voice is artificial;
 * have the lawyer confirm this wording before launch.
 */
export const NOT_A_PERSON = "a computer voice, not a real person";

export const BRAND = {
  name: BRAND_NAME,
  assistant: ASSISTANT_NAME,
  assistantKind: ASSISTANT_KIND,
  tagline: "Talk out loud. Get your words back, ready to use.",
} as const;
