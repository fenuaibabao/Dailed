import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Sign in</h1>
      <AuthForm mode="signIn" />
    </>
  );
}
