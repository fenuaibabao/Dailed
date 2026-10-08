import { ConvexError, v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireUserId } from "./lib/auth";
import { RECORDING_CONSENT_TEXT } from "../src/lib/consent";

export async function activeRecordingConsent(ctx: QueryCtx, userId: Id<"users">) {
  const rows = await ctx.db
    .query("consents")
    .withIndex("by_user_kind", (q) => q.eq("userId", userId).eq("kind", "recording"))
    .order("desc")
    .collect();
  return rows.find((row) => row.revokedAt === undefined) ?? null;
}

export const myRecordingConsent = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const consent = await activeRecordingConsent(ctx, userId);
    return consent === null ? null : { grantedAt: consent.grantedAt };
  },
});

/**
 * Records the recording opt-in. Called from a Next.js server action, which
 * adds the request's IP and user agent; both are best-effort evidence.
 */
export const grantRecording = mutation({
  args: {
    consentText: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (args.consentText !== RECORDING_CONSENT_TEXT) {
      throw new ConvexError("CONSENT_TEXT_MISMATCH");
    }
    const existing = await activeRecordingConsent(ctx, userId);
    if (existing !== null) return existing._id;
    return await ctx.db.insert("consents", {
      userId,
      kind: "recording",
      consentText: args.consentText,
      ipAddress: args.ipAddress?.slice(0, 64),
      userAgent: args.userAgent?.slice(0, 512),
      grantedAt: Date.now(),
    });
  },
});
