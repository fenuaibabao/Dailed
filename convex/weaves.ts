import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { getProduct } from "../src/config/products";
import { requireUserId } from "./lib/auth";
import { getLlmProvider } from "./lib/llm";
import { getOwnedCall } from "./lib/ownership";
import { completeValidated } from "./lib/processing";
import {
  MAX_CANDIDATE_WEAVES,
  WEAVE_SYSTEM_PROMPT,
  buildWeaveInput,
  resolveAssignments,
  weaveResultSchema,
} from "./lib/weaving";

/** Everything weaving needs for one finished session, or null if there's nothing to do. */
export const loadWeaveJob = internalQuery({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const call = await ctx.db.get(callId);
    if (call === null || call.status !== "completed" || call.wovenAt !== undefined) return null;
    const persona = await ctx.db.get(call.personaId);
    if (persona === null) return null;
    const outputs = await ctx.db
      .query("outputs")
      .withIndex("by_call", (q) => q.eq("callId", callId))
      .collect();
    const summary = outputs.find((o) => o.kind === "session_summary")?.body;
    if (summary === undefined) return null;
    const candidates = await ctx.db
      .query("weaves")
      .withIndex("by_user_app_sensitive_updated", (q) =>
        q.eq("userId", call.userId).eq("appId", call.appId).eq("sensitive", call.sensitive),
      )
      .order("desc")
      .take(MAX_CANDIDATE_WEAVES);
    return {
      provider: persona.llmProvider,
      model: persona.llmModel,
      summary,
      themes: outputs.filter((o) => o.kind === "theme").map((o) => o.body),
      focus: call.focus ?? null,
      candidates: candidates.map((w) => ({ id: w._id as string, title: w.title, summary: w.summary })),
    };
  },
});

/** Saves a session's weaves exactly once. Ids are re-checked against the call's owner. */
export const applyWeaves = internalMutation({
  args: {
    callId: v.id("calls"),
    assignments: v.array(
      v.object({
        weaveId: v.union(v.null(), v.id("weaves")),
        title: v.string(),
        summary: v.string(),
        note: v.string(),
      }),
    ),
  },
  handler: async (ctx, { callId, assignments }) => {
    const call = await ctx.db.get(callId);
    if (call === null || call.wovenAt !== undefined) return;
    const now = Date.now();
    for (const a of assignments) {
      const existing = a.weaveId === null ? null : await ctx.db.get(a.weaveId);
      const usable =
        existing !== null &&
        existing.userId === call.userId &&
        existing.appId === call.appId &&
        existing.sensitive === call.sensitive;
      let weaveId: Id<"weaves">;
      if (usable) {
        weaveId = existing._id;
        await ctx.db.patch(weaveId, {
          summary: a.summary,
          sessionCount: existing.sessionCount + 1,
          lastCallId: callId,
          updatedAt: now,
        });
      } else {
        weaveId = await ctx.db.insert("weaves", {
          userId: call.userId,
          appId: call.appId,
          title: a.title,
          summary: a.summary,
          sessionCount: 1,
          lastCallId: callId,
          updatedAt: now,
          sensitive: call.sensitive,
        });
      }
      await ctx.db.insert("weaveLinks", { weaveId, callId, userId: call.userId, note: a.note });
    }
    await ctx.db.patch(callId, { wovenAt: now });
  },
});

/**
 * Groups a finished session into the person's weaves. Scheduled after a
 * session's results are saved. A failure here never touches the session's
 * drafts; the session just stays unwoven.
 */
export const weaveCall = internalAction({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const job = await ctx.runQuery(internal.weaves.loadWeaveJob, { callId });
    if (job === null) return;
    try {
      const result = await completeValidated(
        getLlmProvider(job.provider),
        { model: job.model, system: WEAVE_SYSTEM_PROMPT, user: buildWeaveInput(job.candidates, job) },
        weaveResultSchema,
      );
      const assignments = resolveAssignments(result, job.candidates).map((a) => ({
        ...a,
        weaveId: a.weaveId as Id<"weaves"> | null,
      }));
      await ctx.runMutation(internal.weaves.applyWeaves, { callId, assignments });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error";
      console.error(`Weaving failed for call ${callId}: ${reason}`);
    }
  },
});

const SESSIONS_PER_WEAVE = 20;

/** The signed-in person's weaves in one product, newest activity first. */
export const listMine = query({
  args: { product: v.string() },
  handler: async (ctx, { product: slug }) => {
    const userId = await requireUserId(ctx);
    const product = getProduct(slug);
    if (product === null) return [];
    const app = await ctx.db
      .query("apps")
      .withIndex("by_slug", (q) => q.eq("slug", product.slug))
      .unique();
    if (app === null) return [];
    const weaves = await ctx.db
      .query("weaves")
      .withIndex("by_user_app_updated", (q) => q.eq("userId", userId).eq("appId", app._id))
      .order("desc")
      .take(30);
    return await Promise.all(
      weaves.map(async (weave) => {
        const links = await ctx.db
          .query("weaveLinks")
          .withIndex("by_weave", (q) => q.eq("weaveId", weave._id))
          .order("desc")
          .take(SESSIONS_PER_WEAVE);
        const sessions = [];
        for (const link of links) {
          const call = await ctx.db.get(link.callId);
          if (call === null || call.userId !== userId) continue;
          sessions.push({
            callId: call._id,
            when: call.startedAt ?? call._creationTime,
            note: link.note,
          });
        }
        return {
          _id: weave._id,
          title: weave.title,
          summary: weave.summary,
          sessionCount: weave.sessionCount,
          updatedAt: weave.updatedAt,
          sessions,
        };
      }),
    );
  },
});

/** The weaves one of the person's sessions belongs to. */
export const forCall = query({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const userId = await requireUserId(ctx);
    await getOwnedCall(ctx, userId, callId);
    const links = await ctx.db
      .query("weaveLinks")
      .withIndex("by_call", (q) => q.eq("callId", callId))
      .collect();
    const result = [];
    for (const link of links) {
      const weave = await ctx.db.get(link.weaveId);
      if (weave === null || weave.userId !== userId) continue;
      result.push({ _id: weave._id, title: weave.title, sessionCount: weave.sessionCount, note: link.note });
    }
    return result;
  },
});
