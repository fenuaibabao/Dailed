import { query } from "./_generated/server";
import { requireUserId } from "./lib/auth";

/** The signed-in user's own profile. */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    if (user === null) return null;
    return {
      _id: user._id,
      name: user.name ?? null,
      email: user.email ?? null,
      timezone: user.timezone ?? null,
    };
  },
});
