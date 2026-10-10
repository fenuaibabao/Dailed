import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductLanding } from "@/components/product/ProductLanding";
import { ALL_PRODUCTS, getProduct } from "@/config/products";

// One landing page per product in src/config/products.ts (/create, /clarity,
// ...). Anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return ALL_PRODUCTS.map((p) => ({ product: p.slug }));
}

type Params = { params: Promise<{ product: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const product = getProduct((await params).product);
  return product ? { title: product.name, description: product.headline } : {};
}

export default async function ProductPage({ params }: Params) {
  const product = getProduct((await params).product);
  if (product === null) notFound();
  return <ProductLanding product={product} />;
}
