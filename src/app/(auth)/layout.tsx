import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center gap-7 px-4 pt-14 pb-12">
      <Link href="/" className="text-foreground no-underline hover:text-foreground">
        <Logo size={28} />
      </Link>
      <div className="card-raised w-full max-w-[440px] p-6 sm:p-10">{children}</div>
    </main>
  );
}
