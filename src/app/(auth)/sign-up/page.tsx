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
      <div className="mb-6 flex flex-col gap-1.5">
        <h1 className="m-0 text-[28px] font-semibold leading-tight tracking-[-0.02em]">Create your account</h1>
        <p className="m-0 text-muted">Takes a minute. Then you can start talking.</p>
      </div>
      <AuthForm mode="signUp" product={product?.enabled ? product.slug : undefined} />
    </>
  );
}
