/**
 * The brand name. Change it here and nowhere else: the UI, page titles,
 * product names (src/config/products.ts), the Convex seed and Remi's prompt all
 * read from this file. Production deploys
 * re-run the seed, so the stored app name and Remi's prompt follow it.
 */
export const BRAND_NAME = "Warpwork";

export const BRAND = {
  name: BRAND_NAME,
  tagline: "Talk it through. Get drafts in your own words.",
} as const;
