"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { SuiteProduct } from "@/config/suite";

/**
 * A "Products" menu listing every product page, in the landing page header
 * and the signed-in phone top bar.
 * A native <details> so it works without JavaScript; the script only closes
 * it on a click outside or Escape.
 */
export function ProductSwitcher({
  products,
  current,
  align = "auto",
}: {
  products: SuiteProduct[];
  current?: string;
  /** "auto" opens rightward on phones and leftward on wider screens. */
  align?: "auto" | "right";
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function close(event: Event) {
      const details = ref.current;
      if (!details?.open) return;
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        details.open = false;
        details.querySelector("summary")?.focus();
      } else if (!details.contains(event.target as Node)) {
        details.open = false;
      }
    }
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  return (
    <details ref={ref} className="relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-[10px] px-2.5 text-soft hover:text-foreground [&::-webkit-details-marker]:hidden">
        Products
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <nav
        aria-label="Products"
        className={`card-raised absolute z-20 mt-2 w-60 max-w-[calc(100vw-32px)] p-2 ${align === "right" ? "right-0" : "left-0 sm:left-auto sm:right-0"}`}
      >
        <ul className="m-0 list-none p-0">
          {products.map((p) => (
            <li key={p.slug}>
              <Link
                href={p.href}
                aria-current={p.slug === current ? "page" : undefined}
                onClick={() => {
                  if (ref.current) ref.current.open = false;
                }}
                className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 text-foreground no-underline hover:bg-surface-2 hover:text-foreground aria-[current=page]:bg-accent-surface aria-[current=page]:font-medium"
              >
                {p.shortName}
                {!p.enabled && <span className="tag">Soon</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </details>
  );
}
