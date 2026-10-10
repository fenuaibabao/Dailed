import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { audit } from "./lib/audit";
import { requireUserId } from "./lib/auth";
import { getOwnedCall } from "./lib/ownership";
import { DAY_MS, checkRetention, isLive, purgeCallContent } from "./lib/retention";

export const SESSION_ACTIVE = "SESSION_ACTIVE";

/** The signed-in person's data settings. */
export const mySettings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    return {
      retentionDays: user?.retentionDays ?? null,
      redactTranscripts: user?.redactTranscripts ?? false,
    };
  },
});

export const setRetention = mutation({
  args: { days: v.union(v.null(), v.number()) },
  handler: async (ctx, { days }) => {
    const userId = await requireUserId(ctx);
    const retentionDays = checkRetention(days);
    await ctx.db.patch(userId, { retentionDays });
    await audit(ctx, { action: "user.retention", actorId: userId, userId, details: { days } });
  },
});

export const setRedaction = mutation({
  args: { on: v.boolean() },
  handler: async (ctx, { on }) => {
    const userId = await requireUserId(ctx);
    await ctx.db.patch(userId, { redactTranscripts: on });
    await audit(ctx, { action: "user.redaction", actorId: userId, userId, details: { on } });
  },
});

/** Deletes one of your sessions' content now. The dated record stays. */
export const deleteSession = mutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const userId = await requireUserId(ctx);
    const call = await getOwnedCall(ctx, userId, callId);
    if (isLive(call)) throw new ConvexError(SESSION_ACTIVE);
    if (await purgeCallContent(ctx, call)) {
      await audit(ctx, { action: "session.delete", actorId: userId, userId, orgId: call.orgId, targetId: callId });
    }
  },
});

/**
 * Everything stored about the signed-in person, as one JSON-ready object.
 * A mutation rather than a query so the export itself is logged.
 */
export const exportMine = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    const consents = await ctx.db
      .query("consents")
      .withIndex("by_user_kind", (q) => q.eq("userId", userId))
      .collect();
    const calls = await ctx.db
      .query("calls")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const appNames = new Map<Id<"apps">, string>();
    const sessions = [];
    for (const call of calls) {
      if (!appNames.has(call.appId)) appNames.set(call.appId, (await ctx.db.get(call.appId))?.name ?? "");
      const outputs = await ctx.db
        .query("outputs")
        .withIndex("by_call", (q) => q.eq("callId", call._id))
        .collect();
      sessions.push({
        id: call._id,
        product: appNames.get(call.appId) ?? null,
        workspaceId: call.orgId ?? null,
        status: call.status,
        createdAt: new Date(call._creationTime).toISOString(),
        startedAt: call.startedAt ? new Date(call.startedAt).toISOString() : null,
        durationSeconds: call.durationSeconds ?? null,
        focus: call.focus ?? null,
        transcript: call.transcript ?? null,
        recordingUrl: call.recordingUrl ?? null,
        contentDeletedAt: call.purgedAt ? new Date(call.purgedAt).toISOString() : null,
        outputs: outputs.map((o) => ({
          kind: o.kind,
          platform: o.platform ?? null,
          title: o.title ?? null,
          body: o.body,
          sourceExcerpt: o.sourceExcerpt ?? null,
          status: o.status,
        })),
      });
    }
    const memories = [];
    const weaves = [];
    for (const appId of appNames.keys()) {
      for (const sensitive of [false, true]) {
        const rows = await ctx.db
          .query("memories")
          .withIndex("by_user_app_sensitive_importance", (q) =>
            q.eq("userId", userId).eq("appId", appId).eq("sensitive", sensitive),
          )
          .collect();
        memories.push(
          ...rows.map((m) => ({ product: appNames.get(appId), kind: m.kind, content: m.content, importance: m.importance })),
        );
      }
      const appWeaves = await ctx.db
        .query("weaves")
        .withIndex("by_user_app_updated", (q) => q.eq("userId", userId).eq("appId", appId))
        .collect();
      weaves.push(
        ...appWeaves.map((w) => ({ product: appNames.get(appId), title: w.title, summary: w.summary, sessionCount: w.sessionCount })),
      );
    }
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const workspaces = [];
    for (const m of memberships) {
      const org = await ctx.db.get(m.orgId);
      if (org !== null) workspaces.push({ id: org._id, name: org.name, role: m.role });
    }

    await audit(ctx, {
      action: "data.export",
      actorId: userId,
      userId,
      details: { sessions: sessions.length },
    });
    return {
      exportedAt: new Date().toISOString(),
      profile: {
        name: user?.name ?? null,
        email: user?.email ?? null,
        timezone: user?.timezone ?? null,
        retentionDays: user?.retentionDays ?? null,
        redactTranscripts: user?.redactTranscripts ?? false,
      },
      consents: consents.map((c) => ({
        kind: c.kind,
        text: c.consentText,
        grantedAt: new Date(c.grantedAt).toISOString(),
        revokedAt: c.revokedAt ? new Date(c.revokedAt).toISOString() : null,
      })),
      workspaces,
      sessions,
      memories,
      weaves,
    };
  },
});

const ACTIVITY_LIMIT = 50;

/** Recent audit entries about the signed-in person. */
export const myActivity = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const entries = await ctx.db
      .query("auditLog")
      .withIndex("by_user_at", (q) => q.eq("userId", userId))
      .order("desc")
      .take(ACTIVITY_LIMIT);
    const orgNames = new Map<string, string | null>();
    const result = [];
    for (const e of entries) {
      if (e.orgId !== undefined && !orgNames.has(e.orgId)) {
        orgNames.set(e.orgId, (await ctx.db.get(e.orgId))?.name ?? null);
      }
      result.push({
        _id: e._id,
        action: e.action,
        at: e.at,
        byMe: e.actorId === userId,
        bySystem: e.actorId === undefined,
        workspace: e.orgId !== undefined ? (orgNames.get(e.orgId) ?? null) : null,
        details: e.details ?? null,
      });
    }
    return result;
  },
});

// ---------------------------------------------------------------------------
// Retention job
// ---------------------------------------------------------------------------

/** Sessions purged per run; a run that hits it schedules another. */
export const PURGE_BATCH = 100;

/** Deletes session content past the person's or workspace's limit. Runs daily. */
export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let budget = PURGE_BATCH;
    const purgedFor = new Map<string, { userId?: Id<"users">; orgId?: Id<"orgs">; count: number }>();

    async function purgeOlderThan(
      scope: { userId: Id<"users"> } | { orgId: Id<"orgs"> },
      days: number,
    ) {
      const cutoff = now - days * DAY_MS;
      const expired =
        "userId" in scope
          ? ctx.db.query("calls").withIndex("by_user", (q) => q.eq("userId", scope.userId).lt("_creationTime", cutoff))
          : ctx.db.query("calls").withIndex("by_org", (q) => q.eq("orgId", scope.orgId).lt("_creationTime", cutoff));
      const calls = await expired.filter((q) => q.eq(q.field("purgedAt"), undefined)).take(budget);
      for (const call of calls) {
        if (isLive(call) || !(await purgeCallContent(ctx, call))) continue;
        budget--;
        const key = "userId" in scope ? `u:${scope.userId}` : `o:${scope.orgId}`;
        const entry = purgedFor.get(key) ?? { ...scope, count: 0 };
        entry.count++;
        purgedFor.set(key, entry);
      }
    }

    const users = await ctx.db
      .query("users")
      .withIndex("by_retention", (q) => q.gt("retentionDays", 0))
      .collect();
    for (const user of users) {
      if (budget <= 0) break;
      await purgeOlderThan({ userId: user._id }, user.retentionDays!);
    }
    const orgs = await ctx.db
      .query("orgs")
      .withIndex("by_retention", (q) => q.gt("retentionDays", 0))
      .collect();
    for (const org of orgs) {
      if (budget <= 0) break;
      await purgeOlderThan({ orgId: org._id }, org.retentionDays!);
    }
    for (const entry of purgedFor.values()) {
      await audit(ctx, {
        action: "retention.purge",
        userId: entry.userId,
        orgId: entry.orgId,
        details: { sessions: entry.count },
      });
    }
    if (budget <= 0) await ctx.scheduler.runAfter(0, internal.privacy.purgeExpired, {});
  },
});
