import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { audit } from "./lib/audit";
import { requireUserId } from "./lib/auth";
import { validateDailySetup, type DailySetupErrors } from "../src/lib/dailySetup";

export const INVALID_SETUP = "INVALID_SETUP";

async function myCircle(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("careCircles")
    .withIndex("by_owner", (q) => q.eq("ownerId", userId))
    .unique();
}

/** A person's Daily setup, or null if they haven't set it up. Also used by the data export. */
export async function loadSetup(ctx: QueryCtx, userId: Id<"users">) {
  const circle = await myCircle(ctx, userId);
  if (circle === null) return null;
  const recipient = await ctx.db
    .query("careRecipients")
    .withIndex("by_circle", (q) => q.eq("circleId", circle._id))
    .first();
  if (recipient === null) return null;
  const schedule = await ctx.db
    .query("checkInSchedules")
    .withIndex("by_recipient", (q) => q.eq("recipientId", recipient._id))
    .first();
  const members = await ctx.db
    .query("circleMembers")
    .withIndex("by_circle", (q) => q.eq("circleId", circle._id))
    .collect();
  const owner = members.find((m) => m.role === "owner");
  return {
    parentName: recipient.name,
    parentPhone: recipient.phoneE164,
    timezone: recipient.timezone,
    callConsent: recipient.callConsent,
    days: schedule?.daysOfWeek ?? [],
    windowStart: schedule?.windowStart ?? "",
    windowEnd: schedule?.windowEnd ?? "",
    paused: schedule?.paused ?? false,
    talkAbout: recipient.talkAbout,
    avoid: recipient.avoid,
    checkItems: recipient.checkItems,
    ownerEmail: owner?.email ?? null,
    familyMembers: members.filter((m) => m.role === "member").map((m) => ({ name: m.name, email: m.email })),
    emergencyName: recipient.emergencyContact.name,
    emergencyPhone: recipient.emergencyContact.phoneE164,
  };
}

/** The caller's Daily setup, or null if they haven't set it up. */
export const mySetup = query({
  args: {},
  handler: async (ctx) => loadSetup(ctx, await requireUserId(ctx)),
});

/**
 * Creates or replaces the caller's Daily setup. Nothing calls anyone yet:
 * calls start only once phone calls are built and the parent says yes.
 */
export const saveSetup = mutation({
  args: {
    parentName: v.string(),
    parentPhone: v.string(),
    timezone: v.string(),
    days: v.array(v.number()),
    windowStart: v.string(),
    windowEnd: v.string(),
    talkAbout: v.array(v.string()),
    avoid: v.array(v.string()),
    checkItems: v.array(v.string()),
    familyMembers: v.array(v.object({ name: v.string(), email: v.string() })),
    emergencyName: v.string(),
    emergencyPhone: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const result = validateDailySetup(args);
    if (!result.ok) throw new ConvexError({ code: INVALID_SETUP, fields: result.errors as DailySetupErrors });
    const setup = result.setup;
    const user = await ctx.db.get(userId);
    const now = Date.now();

    let circle = await myCircle(ctx, userId);
    const created = circle === null;
    if (circle === null) {
      const circleId = await ctx.db.insert("careCircles", { ownerId: userId, createdAt: now });
      circle = (await ctx.db.get(circleId))!;
    }
    const circleId = circle._id;

    const recipientFields = {
      name: setup.parentName,
      phoneE164: setup.parentPhone,
      timezone: setup.timezone,
      talkAbout: setup.talkAbout,
      avoid: setup.avoid,
      checkItems: setup.checkItems,
      emergencyContact: { name: setup.emergencyName, phoneE164: setup.emergencyPhone },
      updatedAt: now,
    };
    const existing = await ctx.db
      .query("careRecipients")
      .withIndex("by_circle", (q) => q.eq("circleId", circleId))
      .first();
    let recipientId: Id<"careRecipients">;
    if (existing === null) {
      recipientId = await ctx.db.insert("careRecipients", { circleId, callConsent: "not_asked", ...recipientFields });
    } else {
      recipientId = existing._id;
      // A new number is a new person to ask: consent belongs to whoever answers.
      const callConsent = existing.phoneE164 === setup.parentPhone ? existing.callConsent : "not_asked";
      await ctx.db.patch(recipientId, { ...recipientFields, callConsent });
    }

    const schedule = await ctx.db
      .query("checkInSchedules")
      .withIndex("by_recipient", (q) => q.eq("recipientId", recipientId))
      .first();
    const scheduleFields = {
      daysOfWeek: setup.days,
      windowStart: setup.windowStart,
      windowEnd: setup.windowEnd,
    };
    if (schedule === null) {
      await ctx.db.insert("checkInSchedules", { circleId, recipientId, paused: false, ...scheduleFields });
    } else {
      await ctx.db.patch(schedule._id, scheduleFields);
    }

    // The owner always gets summaries and alerts; the other members are
    // replaced by the list from the form.
    const members = await ctx.db
      .query("circleMembers")
      .withIndex("by_circle", (q) => q.eq("circleId", circleId))
      .collect();
    const ownerEmail = user?.email ?? "";
    if (!members.some((m) => m.role === "owner")) {
      await ctx.db.insert("circleMembers", {
        circleId,
        userId,
        name: user?.name ?? "",
        email: ownerEmail,
        role: "owner",
        getsSummaries: true,
        getsAlerts: true,
      });
    }
    for (const m of members) if (m.role === "member") await ctx.db.delete(m._id);
    for (const m of setup.familyMembers) {
      if (m.email === ownerEmail) continue;
      await ctx.db.insert("circleMembers", {
        circleId,
        name: m.name,
        email: m.email,
        role: "member",
        getsSummaries: true,
        getsAlerts: true,
      });
    }

    await audit(ctx, { action: "daily.setup", actorId: userId, userId, details: { created } });
    return null;
  },
});

export const NOT_SET_UP = "NOT_SET_UP";

/** Pauses or resumes the calls. Pausing never needs the parent's say; resuming still needs their yes. */
export const setPaused = mutation({
  args: { paused: v.boolean() },
  handler: async (ctx, { paused }) => {
    const userId = await requireUserId(ctx);
    const circle = await myCircle(ctx, userId);
    const schedule =
      circle &&
      (await ctx.db
        .query("checkInSchedules")
        .withIndex("by_circle", (q) => q.eq("circleId", circle._id))
        .first());
    if (!schedule) throw new ConvexError(NOT_SET_UP);
    if (schedule.paused === paused) return null;
    await ctx.db.patch(schedule._id, { paused });
    await audit(ctx, { action: "daily.pause", actorId: userId, userId, details: { paused } });
    return null;
  },
});
