import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

// A global spend cap (docs/PRIMER.md, section 10). Once the last 24 hours of
// voice spend reach the cap, no new browser sessions start and the Daily
// scheduler places no calls until spend falls back under it. Calls already in
// progress finish normally.

export const SPEND_CAP_REACHED = "SPEND_CAP_REACHED";

/** Used when SPEND_CAP_USD_PER_DAY isn't set: low enough to catch a runaway loop. */
export const DEFAULT_SPEND_CAP_USD = 20;
/** Calls still running have no cost yet; each counts as this much until its report arrives. */
export const IN_FLIGHT_ESTIMATE_USD = 2;
const WINDOW_MS = 24 * 60 * 60 * 1000;

/** The cap from SPEND_CAP_USD_PER_DAY, or the default if it's missing or not a positive number. */
export function spendCapUsd(raw: string | undefined = process.env.SPEND_CAP_USD_PER_DAY): number {
  const value = Number(raw);
  return raw !== undefined && raw.trim() !== "" && Number.isFinite(value) && value > 0 ? value : DEFAULT_SPEND_CAP_USD;
}

const IN_FLIGHT: ReadonlySet<Doc<"calls">["status"]> = new Set(["queued", "connecting", "in_session"]);

/** Known cost of these calls, plus an estimate for any still running. */
export function estimateSpend(calls: Pick<Doc<"calls">, "status" | "costUsd">[]): number {
  let total = 0;
  for (const call of calls) {
    if (call.costUsd !== undefined) total += call.costUsd;
    else if (IN_FLIGHT.has(call.status)) total += IN_FLIGHT_ESTIMATE_USD;
  }
  return Math.round(total * 100) / 100;
}

/** Voice spend over the last 24 hours, across every user and product. */
export async function spentLast24h(ctx: QueryCtx, now = Date.now()): Promise<number> {
  const calls = await ctx.db
    .query("calls")
    .withIndex("by_creation_time", (q) => q.gt("_creationTime", now - WINDOW_MS))
    .collect();
  return estimateSpend(calls);
}

export async function isOverSpendCap(ctx: QueryCtx, now = Date.now()): Promise<boolean> {
  return (await spentLast24h(ctx, now)) >= spendCapUsd();
}
