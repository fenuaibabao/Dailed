import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { timingSafeEqualStrings } from "./lib/secrets";

export const INVALID_WEBHOOK_SECRET = "INVALID_WEBHOOK_SECRET";

/**
 * Called by /api/vapi/webhook after it has verified the request. Public so the
 * Next.js route can reach it, so it checks the shared secret again itself.
 *
 * Only updates a call this app created (matched by metadata.call_id and/or the
 * stored Vapi call id). Never creates calls. Safe to receive twice.
 */
export const recordEndOfCallReport = mutation({
  args: {
    secret: v.string(),
    report: v.object({
      callId: v.optional(v.string()),
      vapiCallId: v.optional(v.string()),
      transcript: v.optional(v.string()),
      recordingUrl: v.optional(v.string()),
      durationSeconds: v.optional(v.number()),
      costUsd: v.optional(v.number()),
      endedReason: v.optional(v.string()),
      startedAt: v.optional(v.number()),
      endedAt: v.optional(v.number()),
    }),
  },
  handler: async (ctx, { secret, report }) => {
    const expected = process.env.VAPI_WEBHOOK_SECRET;
    if (!expected || !timingSafeEqualStrings(secret, expected)) {
      throw new ConvexError(INVALID_WEBHOOK_SECRET);
    }

    let call: Doc<"calls"> | null = null;
    const normalizedId: Id<"calls"> | null =
      report.callId !== undefined ? ctx.db.normalizeId("calls", report.callId) : null;
    if (normalizedId !== null) {
      call = await ctx.db.get(normalizedId);
    }
    if (call === null && report.vapiCallId !== undefined) {
      call = await ctx.db
        .query("calls")
        .withIndex("by_vapi_call_id", (q) => q.eq("vapiCallId", report.vapiCallId))
        .first();
    }
    if (call === null) return { outcome: "unknown_call" as const };

    // A metadata id pointing at a call that's tied to a different Vapi call is
    // not ours to update.
    if (
      report.vapiCallId !== undefined &&
      call.vapiCallId !== undefined &&
      call.vapiCallId !== report.vapiCallId
    ) {
      return { outcome: "vapi_call_id_mismatch" as const };
    }
    if (call.reportReceivedAt !== undefined) {
      return { outcome: "duplicate" as const };
    }

    const transcript = report.transcript?.trim() ?? "";
    const hasTranscript = transcript.length > 0;
    await ctx.db.patch(call._id, {
      vapiCallId: call.vapiCallId ?? report.vapiCallId,
      transcript: hasTranscript ? transcript : undefined,
      recordingUrl: report.recordingUrl,
      durationSeconds:
        report.durationSeconds !== undefined ? Math.round(report.durationSeconds) : undefined,
      costUsd: report.costUsd,
      endReason: report.endedReason?.slice(0, 200),
      startedAt: report.startedAt ?? call.startedAt,
      endedAt: report.endedAt ?? Date.now(),
      reportReceivedAt: Date.now(),
      status: hasTranscript ? "processing" : "failed",
      processingError: hasTranscript ? undefined : "The session ended before anything was said.",
    });
    if (hasTranscript) {
      await ctx.scheduler.runAfter(0, internal.processor.run, { callId: call._id });
    }
    return { outcome: "updated" as const };
  },
});
