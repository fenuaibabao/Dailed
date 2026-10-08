/**
 * The product name is a working codename. Change it here and nowhere else:
 * the UI, page titles, the Convex seed and Remi's prompt all read from this file.
 */
export const BRAND = {
  name: "Dialed",
  tagline: "Talk it through. Get drafts in your own words.",
} as const;

export const APPS = {
  create: { slug: "create", name: `${BRAND.name} Create` },
} as const;
