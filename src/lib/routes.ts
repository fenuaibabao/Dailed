export const SIGN_IN_PATH = "/sign-in";
export const SIGN_UP_PATH = "/sign-up";
export const AFTER_AUTH_PATH = "/app/session";

/** Adds ?product=<slug> so the product someone entered through survives sign-in. */
export function withProduct(path: string, product: string | null | undefined): string {
  return product ? `${path}?product=${encodeURIComponent(product)}` : path;
}
