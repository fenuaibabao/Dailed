import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { getProduct } from "@/config/products";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const product = getProduct((await searchParams).product);
  return (
    <>
      <h1 className="mb-6 text-[28px] font-semibold leading-tight tracking-[-0.02em]">Create your account</h1>
      <AuthForm mode="signUp" product={product?.enabled ? product.slug : undefined} />
    </>
  );
}
