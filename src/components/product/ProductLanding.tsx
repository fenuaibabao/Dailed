import Link from "next/link";
import { BRAND } from "@/config/brand";
import type { ProductConfig } from "@/config/products";
import { SIGN_IN_PATH, SIGN_UP_PATH, withProduct } from "@/lib/routes";

/** A product's landing page. The product chosen here carries through sign-up to the session page. */
export function ProductLanding({ product }: { product: ProductConfig }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-16">
      <p className="text-sm font-medium text-accent">{product.name}</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">{BRAND.name}</h1>
      <p className="mt-4 text-lg text-muted">{product.headline}</p>
      {product.enabled ? (
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={withProduct(SIGN_UP_PATH, product.slug)}
            className="rounded-md bg-accent px-4 py-2 font-medium text-accent-foreground"
          >
            Start talking
          </Link>
          <Link
            href={withProduct(SIGN_IN_PATH, product.slug)}
            className="rounded-md border border-border px-4 py-2 font-medium"
          >
            Sign in
          </Link>
        </div>
      ) : (
        <p className="mt-8 rounded-md border border-border px-4 py-3 text-muted" data-testid="coming-soon">
          Coming soon.
        </p>
      )}
    </main>
  );
}
