/**
 * The brand name. Change it here and nowhere else: the UI, page titles,
 * product names (src/config/products.ts), the Convex seed and Remi's prompt all
 * read from this file. Production deploys
 * re-run the seed, so the stored app name and Remi's prompt follow it.
 */
export const BRAND_NAME = "Warpwork";

/**
 * The AI interviewer's name, used in its prompt, its first words on every call
 * and the UI. Like the brand, it may change before launch, so never hard-code it.
 */
export const ASSISTANT_NAME = "Remi";

export const BRAND = {
  name: BRAND_NAME,
  assistant: ASSISTANT_NAME,
  tagline: "Talk it through. Get drafts in your own words.",
} as const;
