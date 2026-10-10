import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { getProduct } from "@/config/products";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const product = getProduct((await searchParams).product);
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Sign in</h1>
      <AuthForm mode="signIn" product={product?.enabled ? product.slug : undefined} />
    </>
  );
}
