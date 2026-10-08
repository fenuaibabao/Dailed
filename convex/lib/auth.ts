import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";

export const UNAUTHENTICATED = "UNAUTHENTICATED";

/**
 * The only way public functions learn who the user is. Functions never take a
 * userId argument from the client.
 */
export async function requireUserId(
  ctx: QueryCtx | MutationCtx | ActionCtx,
): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError(UNAUTHENTICATED);
  }
  return userId;
}
