import { ProductLanding } from "@/components/product/ProductLanding";
import { DEFAULT_PRODUCT, PRODUCTS } from "@/config/products";

export default function Home() {
  return <ProductLanding product={PRODUCTS[DEFAULT_PRODUCT]} />;
}
