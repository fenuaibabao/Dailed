import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export const NOT_FOUND = "NOT_FOUND";

/**
 * Loads a call the user owns. Someone else's call and a missing call throw the
 * same error, so ids can't be probed.
 */
export async function getOwnedCall(
  ctx: QueryCtx,
  userId: Id<"users">,
  callId: Id<"calls">,
): Promise<Doc<"calls">> {
  const call = await ctx.db.get(callId);
  if (call === null || call.userId !== userId) {
    throw new ConvexError(NOT_FOUND);
  }
  return call;
}
