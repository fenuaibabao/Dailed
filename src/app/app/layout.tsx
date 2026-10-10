import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND } from "@/config/brand";
import { SignOutButton } from "@/components/auth/SignOutButton";

// Access control is in src/middleware.ts. This is only the signed-in shell;
// the sidebar arrives in Milestone 3.
export default function SignedInLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border px-4 py-3 md:px-8">
        <Link href="/app/session" className="font-semibold">
          {BRAND.name}
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/app/workspaces" className="text-sm">
            Workspaces
          </Link>
          <SignOutButton />
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">{children}</main>
    </div>
  );
}
