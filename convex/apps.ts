import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUserId } from "./lib/auth";

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    await requireUserId(ctx);
    const app = await ctx.db
      .query("apps")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (app === null) return null;
    return { _id: app._id, slug: app.slug, name: app.name };
  },
});
