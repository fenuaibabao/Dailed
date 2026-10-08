import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Create your account" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Create your account</h1>
      <AuthForm mode="signUp" />
    </>
  );
}
