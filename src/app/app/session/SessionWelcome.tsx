"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { APPS } from "@/config/brand";

export function SessionWelcome() {
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");

  return (
    <section>
      <p className="text-sm font-medium text-accent">{APPS.create.name}</p>
      <h1 className="mt-1 text-2xl font-semibold" data-testid="session-heading">
        {viewer?.name ? `Welcome, ${viewer.name}` : "Welcome"}
      </h1>
      <p className="mt-3 max-w-prose text-muted">
        Sessions with Remi start here. Quick and deep sessions arrive in the next milestone.
      </p>
    </section>
  );
}
