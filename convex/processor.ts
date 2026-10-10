import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { getLlmProvider } from "./lib/llm";
import { processTranscript } from "./lib/processing";
import { memoryKind } from "./schema";

export const loadJob = internalQuery({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const call = await ctx.db.get(callId);
    if (call === null || call.status !== "processing" || !call.transcript) return null;
    const persona = await ctx.db.get(call.personaId);
    if (persona === null) return null;
    return {
      transcript: call.transcript,
      durationSeconds: call.durationSeconds,
      sensitive: call.sensitive,
      provider: persona.llmProvider,
      model: persona.llmModel,
    };
  },
});

const processedValidator = v.object({
  summary: v.string(),
  themes: v.array(v.string()),
  posts: v.array(
    v.object({
      platform: v.optional(v.string()),
      title: v.optional(v.string()),
      body: v.string(),
      sourceExcerpt: v.string(),
    }),
  ),
  scripts: v.array(
    v.object({ title: v.optional(v.string()), body: v.string(), sourceExcerpt: v.string() }),
  ),
  newsletter: v.union(v.null(), v.object({ title: v.string(), body: v.string() })),
  ideas: v.array(v.string()),
  memories: v.array(v.object({ kind: memoryKind, content: v.string(), importance: v.number() })),
  droppedUngrounded: v.number(),
});

/** Writes a session's outputs and memories exactly once. */
export const saveResults = internalMutation({
  args: { callId: v.id("calls"), result: processedValidator },
  handler: async (ctx, { callId, result }) => {
    const call = await ctx.db.get(callId);
    if (call === null || call.status !== "processing") return;
    const existing = await ctx.db
      .query("outputs")
      .withIndex("by_call", (q) => q.eq("callId", callId))
      .first();
    if (existing !== null) {
      await ctx.db.patch(callId, { status: "completed" });
      return;
    }

    const base = { callId, userId: call.userId, status: "draft" as const };
    await ctx.db.insert("outputs", { ...base, kind: "session_summary", body: result.summary });
    for (const theme of result.themes) {
      await ctx.db.insert("outputs", { ...base, kind: "theme", body: theme });
    }
    for (const post of result.posts) {
      await ctx.db.insert("outputs", {
        ...base,
        kind: "post",
        platform: post.platform,
        title: post.title,
        body: post.body,
        sourceExcerpt: post.sourceExcerpt,
      });
    }
    for (const script of result.scripts) {
      await ctx.db.insert("outputs", {
        ...base,
        kind: "script",
        title: script.title,
        body: script.body,
        sourceExcerpt: script.sourceExcerpt,
      });
    }
    if (result.newsletter !== null) {
      await ctx.db.insert("outputs", {
        ...base,
        kind: "newsletter",
        title: result.newsletter.title,
        body: result.newsletter.body,
      });
    }
    for (const idea of result.ideas) {
      await ctx.db.insert("outputs", { ...base, kind: "idea", body: idea });
    }
    for (const memory of result.memories) {
      await ctx.db.insert("memories", {
        userId: call.userId,
        appId: call.appId,
        callId,
        kind: memory.kind,
        content: memory.content,
        importance: Math.min(5, Math.max(1, Math.round(memory.importance))),
        sensitive: call.sensitive,
      });
    }
    await ctx.db.patch(callId, {
      status: "completed",
      processingError: undefined,
      draftsDropped: result.droppedUngrounded,
    });
  },
});

export const markFailed = internalMutation({
  args: { callId: v.id("calls"), reason: v.string() },
  handler: async (ctx, { callId, reason }) => {
    const call = await ctx.db.get(callId);
    if (call === null || call.status !== "processing") return;
    await ctx.db.patch(callId, { status: "failed", processingError: reason.slice(0, 500) });
  },
});

/** Turns a finished call's transcript into outputs. Scheduled by the webhook. */
export const run = internalAction({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const job = await ctx.runQuery(internal.processor.loadJob, { callId });
    if (job === null) return;
    try {
      const result = await processTranscript(getLlmProvider(job.provider), job);
      // Counts only: transcripts and drafts stay out of logs.
      console.log(
        `Processed call ${callId}: ${result.posts.length} posts, ${result.scripts.length} scripts kept; ` +
          `${result.droppedUngrounded} dropped as ungrounded`,
      );
      await ctx.runMutation(internal.processor.saveResults, { callId, result });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown processing error";
      console.error(`Processing failed for call ${callId}: ${reason}`);
      await ctx.runMutation(internal.processor.markFailed, {
        callId,
        reason: "We couldn't create drafts from this session. Please try again later.",
      });
    }
  },
});
