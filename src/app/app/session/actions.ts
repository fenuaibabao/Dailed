"use server";

import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { headers } from "next/headers";
import { api } from "../../../../convex/_generated/api";
import { RECORDING_CONSENT_TEXT } from "@/lib/consent";

// Errors thrown from server actions are redacted in production, so these
// return a result instead of throwing.
const KNOWN_ERRORS = ["UNAUTHENTICATED", "RECORDING_CONSENT_REQUIRED", "APP_NOT_SEEDED"] as const;
export type ActionErrorCode = (typeof KNOWN_ERRORS)[number] | "UNKNOWN";

function errorCode(error: unknown): ActionErrorCode {
  const text = error instanceof Error ? error.message : String(error);
  return KNOWN_ERRORS.find((code) => text.includes(code)) ?? "UNKNOWN";
}

async function getToken(): Promise<string | null> {
  return (await convexAuthNextjsToken()) ?? null;
}

/** Stores the one-time recording consent with the request's IP and user agent. */
export async function grantRecordingConsent(): Promise<
  { ok: true } | { ok: false; error: ActionErrorCode }
> {
  const token = await getToken();
  if (token === null) return { ok: false, error: "UNAUTHENTICATED" };
  const h = await headers();
  const ipAddress =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined;
  try {
    await fetchMutation(
      api.consents.grantRecording,
      {
        consentText: RECORDING_CONSENT_TEXT,
        ipAddress,
        userAgent: h.get("user-agent") ?? undefined,
      },
      { token },
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorCode(error) };
  }
}

/**
 * The Start action: creates the queued call and returns the Vapi config
 * (assistant id + overrides with the assembled prompt). The browser then
 * starts the web call itself.
 */
export async function startSession(input: { mode: "quick" | "deep"; focus?: string }) {
  const token = await getToken();
  if (token === null) return { ok: false as const, error: "UNAUTHENTICATED" as ActionErrorCode };
  try {
    const config = await fetchMutation(
      api.calls.start,
      { mode: input.mode, focus: input.focus },
      { token },
    );
    return { ok: true as const, ...config };
  } catch (error) {
    return { ok: false as const, error: errorCode(error) };
  }
}
