"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (convexUrl === undefined || convexUrl === "") {
  throw new Error(
    "NEXT_PUBLIC_CONVEX_URL is not set. Run `npx convex dev` or copy .env.example to .env.local.",
  );
}

const convex = new ConvexReactClient(convexUrl);

// The Next.js-specific provider (not the generic ConvexAuthProvider) is what
// keeps the auth cookie in sync with the middleware, so protected routes don't
// bounce signed-in users back to /sign-in.
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthNextjsProvider client={convex}>{children}</ConvexAuthNextjsProvider>
  );
}
