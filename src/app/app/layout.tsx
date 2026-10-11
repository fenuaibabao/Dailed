import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";

// Access control is in src/middleware.ts. This is only the signed-in frame.
export default function SignedInLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
