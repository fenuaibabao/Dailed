import Link from "next/link";
import { BRAND } from "@/config/brand";
import { Logo } from "@/components/brand/Logo";
import type { ProductConfig } from "@/config/products";
import { SIGN_IN_PATH, SIGN_UP_PATH, withProduct } from "@/lib/routes";

/** A product's landing page. The product chosen here carries through sign-up to the session page. */
export function ProductLanding({ product }: { product: ProductConfig }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-6 md:px-10">
      <Link href="/" className="self-start text-foreground no-underline hover:text-foreground">
        <Logo size={24} />
      </Link>
      <div className="flex flex-1 flex-col justify-center py-16">
        <p className="eyebrow">{product.name}</p>
        <h1 className="page-title mt-3 text-[clamp(36px,7vw,56px)]">{BRAND.name}</h1>
        <p className="mt-5 max-w-xl text-lg text-soft">{product.headline}</p>
        {product.enabled ? (
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href={withProduct(SIGN_UP_PATH, product.slug)} className="btn btn-primary btn-lg">
              Start talking
            </Link>
            <Link href={withProduct(SIGN_IN_PATH, product.slug)} className="btn btn-lg">
              Sign in
            </Link>
          </div>
        ) : (
          <p className="notice mt-9 self-start" data-testid="coming-soon">
            Coming soon.
          </p>
        )}
      </div>
    </main>
  );
}
