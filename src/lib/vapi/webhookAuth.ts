import { createHash, timingSafeEqual } from "node:crypto";

function sameSecret(provided: string, expected: string): boolean {
  // Hash first so both sides have equal length for timingSafeEqual.
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Vapi sends the assistant's server secret as `x-vapi-secret`; a Bearer
 * credential in `Authorization` is accepted too. Returns the secret that
 * matched, or null.
 */
export function verifyVapiSecret(headers: Headers, expected: string | undefined): string | null {
  if (!expected) return null;
  const candidates = [
    headers.get("x-vapi-secret"),
    headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null,
  ];
  for (const candidate of candidates) {
    if (candidate && sameSecret(candidate, expected)) return candidate;
  }
  return null;
}
