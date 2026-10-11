"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Logo } from "@/components/brand/Logo";

const ICON_PROPS = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

function HomeIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

// Only pages that exist today. Sessions, Weaves, Studio and Settings join as
// their screens are built.
const NAV = [
  { href: "/app/session", label: "Home", Icon: HomeIcon },
  { href: "/app/workspaces", label: "Workspaces", Icon: PeopleIcon },
  { href: "/app/privacy", label: "Your data", Icon: LockIcon },
] as const;

/**
 * The signed-in frame: a dark sidebar on wide screens, and a bottom tab bar
 * with a slim top bar on phones.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const links = NAV.map(({ href, label, Icon }) => {
    const current = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        key={href}
        href={href}
        aria-current={current ? "page" : undefined}
        className={
          "flex min-h-14 min-w-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] px-1 text-[11px] no-underline " +
          "md:min-h-11 md:flex-none md:flex-row md:justify-start md:gap-3 md:px-3 md:text-[15px] " +
          (current
            ? "font-medium text-white md:bg-ink-raised"
            : "text-ink-text hover:text-white md:hover:bg-ink-raised/60")
        }
      >
        <Icon />
        {label}
      </Link>
    );
  });

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-60 shrink-0 md:block">
        <nav
          aria-label="Main"
          className="sticky top-0 flex h-screen flex-col gap-8 bg-ink px-5 py-7 text-surface-2"
        >
          <Link href="/app/session" className="px-2 text-surface-2 no-underline hover:text-white">
            <Logo />
          </Link>
          <div className="flex flex-col gap-1">{links}</div>
          <div className="mt-auto border-t border-ink-line px-2 pt-5">
            <SignOutButton className="btn btn-sm w-full border-ink-line bg-transparent text-ink-text hover:bg-ink-raised hover:text-white" />
          </div>
        </nav>
      </aside>

      <header className="flex items-center justify-between gap-3 px-4 pt-4 md:hidden">
        <Link href="/app/session" className="text-foreground no-underline">
          <Logo size={22} />
        </Link>
        <SignOutButton />
      </header>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 flex bg-ink px-1.5 pt-1 pb-[calc(4px+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.18)] md:hidden"
      >
        {links}
      </nav>

      <main className="min-w-0 flex-1 px-4 pt-6 pb-28 md:px-12 md:pt-10 md:pb-14">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
