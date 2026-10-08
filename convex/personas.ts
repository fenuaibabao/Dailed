import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUserId } from "./lib/auth";

/**
 * The app's default persona, as the browser needs it. The system prompt stays
 * on the server; it's assembled into the call config in Milestone 2.
 */
export const getDefaultForApp = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    await requireUserId(ctx);
    const app = await ctx.db
      .query("apps")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (app?.defaultPersonaId === undefined) return null;
    const persona = await ctx.db.get(app.defaultPersonaId);
    if (persona === null) return null;
    return {
      _id: persona._id,
      name: persona.name,
      maxCallSeconds: persona.maxCallSeconds,
    };
  },
});
