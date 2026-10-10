import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

// Retention: how long session content is kept. The default is to keep it.
// A person can pick a limit for their own sessions and a workspace owner for
// the workspace's sessions; the shorter one wins. Expired content is deleted
// by a daily job (convex/crons.ts). The call row stays, with its date,
// length and cost, as a record that the session happened.

export const RETENTION_CHOICES = [30, 90, 365] as const;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const INVALID_RETENTION = "INVALID_RETENTION";

export function checkRetention(days: number | null): number | undefined {
  if (days === null) return undefined;
  if (!(RETENTION_CHOICES as readonly number[]).includes(days)) throw new ConvexError(INVALID_RETENTION);
  return days;
}

/** The limit that applies to a session: the shorter of the person's and the workspace's. */
export function effectiveRetention(userDays?: number, orgDays?: number): number | undefined {
  const limits = [userDays, orgDays].filter((d): d is number => d !== undefined);
  return limits.length === 0 ? undefined : Math.min(...limits);
}

const LIVE: Doc<"calls">["status"][] = ["queued", "connecting", "in_session", "processing"];

export function isLive(call: Doc<"calls">): boolean {
  return LIVE.includes(call.status);
}

/**
 * Deletes a session's content: transcript, recording link, outputs,
 * memories and its place in Weaves. A weave left with no sessions is
 * deleted too. Returns false if there was nothing to delete.
 */
export async function purgeCallContent(ctx: MutationCtx, call: Doc<"calls">): Promise<boolean> {
  if (call.purgedAt !== undefined) return false;
  const outputs = await ctx.db
    .query("outputs")
    .withIndex("by_call", (q) => q.eq("callId", call._id))
    .collect();
  for (const o of outputs) await ctx.db.delete(o._id);
  const memories = await ctx.db
    .query("memories")
    .withIndex("by_call", (q) => q.eq("callId", call._id))
    .collect();
  for (const m of memories) await ctx.db.delete(m._id);
  const links = await ctx.db
    .query("weaveLinks")
    .withIndex("by_call", (q) => q.eq("callId", call._id))
    .collect();
  for (const link of links) {
    await ctx.db.delete(link._id);
    const weave = await ctx.db.get(link.weaveId);
    if (weave === null) continue;
    const remaining = await ctx.db
      .query("weaveLinks")
      .withIndex("by_weave", (q) => q.eq("weaveId", weave._id))
      .first();
    if (remaining === null) await ctx.db.delete(weave._id);
    else await ctx.db.patch(weave._id, { sessionCount: Math.max(1, weave.sessionCount - 1) });
  }
  await ctx.db.patch(call._id, {
    transcript: undefined,
    recordingUrl: undefined,
    focus: undefined,
    noDraftsReason: undefined,
    purgedAt: Date.now(),
  });
  return true;
}
