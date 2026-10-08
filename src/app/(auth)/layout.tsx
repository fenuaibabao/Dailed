import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND } from "@/config/brand";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center text-2xl font-semibold">
          {BRAND.name}
        </Link>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          {children}
        </div>
      </div>
    </main>
  );
}
