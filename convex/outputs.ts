import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { getOwnedCall } from "./lib/ownership";

export const forCall = query({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const userId = await requireUserId(ctx);
    await getOwnedCall(ctx, userId, callId);
    const outputs = await ctx.db
      .query("outputs")
      .withIndex("by_call", (q) => q.eq("callId", callId))
      .collect();
    return outputs.map((o) => ({
      _id: o._id,
      kind: o.kind,
      platform: o.platform ?? null,
      title: o.title ?? null,
      body: o.body,
      status: o.status,
      sourceExcerpt: o.sourceExcerpt ?? null,
    }));
  },
});
