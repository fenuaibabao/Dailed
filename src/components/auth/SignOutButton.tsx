"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SIGN_IN_PATH } from "@/lib/routes";

export function SignOutButton() {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await signOut();
        router.push(SIGN_IN_PATH);
      }}
      className="rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-60"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
