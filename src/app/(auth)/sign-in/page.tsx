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
      <div className="mb-6 flex flex-col gap-1.5">
        <h1 className="m-0 text-[28px] font-semibold leading-tight tracking-[-0.02em]">Welcome back</h1>
        <p className="m-0 text-muted">Sign in to pick up where you left off.</p>
      </div>
      <AuthForm mode="signIn" product={product?.enabled ? product.slug : undefined} />
    </>
  );
}
