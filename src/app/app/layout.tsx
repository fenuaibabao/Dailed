import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { SUITE } from "@/config/suite";

// Access control is in src/middleware.ts. This is only the signed-in frame.
export default function SignedInLayout({ children }: { children: ReactNode }) {
  return <AppShell products={SUITE}>{children}</AppShell>;
}
