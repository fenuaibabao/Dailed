"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SIGN_IN_PATH } from "@/lib/routes";

export function SignOutButton({ className = "btn btn-sm" }: { className?: string }) {
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
      className={className}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
