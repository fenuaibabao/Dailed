import type { LlmProviderName } from "./llm";

// Health-data mode (phi_mode). We don't handle protected health information
// yet. A workspace in health-data mode can't run sessions until every vendor
// that would touch a session has signed a BAA with us and is listed here.
// Adding a vendor here is a reviewed code change, never a setting.

export type Vendor = "vapi" | "convex" | "vercel" | LlmProviderName;

/** Vendors with a signed BAA. Empty until those agreements exist. */
export const BAA_COVERED_VENDORS: readonly Vendor[] = [];

/** Every vendor a session passes through: voice, database, hosting and the processing model. */
export function sessionVendors(llmProvider: LlmProviderName): Vendor[] {
  return ["vapi", "convex", "vercel", llmProvider];
}

/** Vendors still missing a BAA for a health-data session with this model. */
export function missingBaas(
  llmProvider: LlmProviderName,
  covered: readonly Vendor[] = BAA_COVERED_VENDORS,
): Vendor[] {
  return sessionVendors(llmProvider).filter((vendor) => !covered.includes(vendor));
}

export const PHI_NOT_READY = "PHI_NOT_READY";
