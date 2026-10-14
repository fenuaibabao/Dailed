import { BRAND } from "./brand";
import { LANDING } from "./landing";
import { ALL_PRODUCTS, productPath, type ProductConfig } from "./products";

/** One product page link, as the Products menus list it. */
export type SuiteProduct = { slug: string; href: string; shortName: string; enabled: boolean };

/** A product's name without the brand, e.g. "Clarity". */
export function shortNameOf(product: ProductConfig): string {
  return LANDING[product.slug]?.shortName ?? product.name.replace(`${BRAND.name} `, "");
}

/** Every product page, in config order, for the Products menus and footer. */
export const SUITE: SuiteProduct[] = ALL_PRODUCTS.map((p) => ({
  slug: p.slug,
  href: productPath(p.slug),
  shortName: shortNameOf(p),
  enabled: p.enabled,
}));
