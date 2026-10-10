import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { APPS } from "../src/config/brand";
import { requireUserId } from "./lib/auth";
import { getOwnedCall } from "./lib/ownership";
import { selectPromptMemories, selectRecentSummaries } from "./lib/promptContext";
import {
  FOCUS_MAX_LENGTH,
  SESSION_MODES,
  buildSessionPrompt,
} from "./lib/sessionPrompt";
import { REMI_START_SPEAKING_PLAN } from "./lib/turnTaking";
import { activeRecordingConsent } from "./consents";
import { callMode } from "./schema";

// If the end-of-call webhook hasn't arrived this long after the browser saw
// the call end, the call is marked failed instead of spinning forever.
export const REPORT_TIMEOUT_MS = 10 * 60 * 1000;

/** Fields the browser is allowed to see. Transcript is left out of lists. */
function publicCall(call: Doc<"calls">) {
  return {
    _id: call._id,
    _creationTime: call._creationTime,
    mode: call.mode,
    status: call.status,
    focus: call.focus ?? null,
    startedAt: call.startedAt ?? null,
    endedAt: call.endedAt ?? null,
    durationSeconds: call.durationSeconds ?? null,
    endReason: call.endReason ?? null,
  };
}

/**
 * Creates a queued call and returns everything the browser needs to start the
 * Vapi web call. The prompt is assembled here, server side.
 */
export const start = mutation({
  args: { mode: callMode, focus: v.optional(v.string()) },
  handler: async (ctx, { mode, focus }) => {
    const userId = await requireUserId(ctx);
    if ((await activeRecordingConsent(ctx, userId)) === null) {
      throw new ConvexError("RECORDING_CONSENT_REQUIRED");
    }
    const trimmedFocus = focus?.trim().slice(0, FOCUS_MAX_LENGTH) || undefined;

    const app = await ctx.db
      .query("apps")
      .withIndex("by_slug", (q) => q.eq("slug", APPS.create.slug))
      .unique();
    const persona =
      app?.defaultPersonaId !== undefined ? await ctx.db.get(app.defaultPersonaId) : null;
    if (app === null || persona === null) {
      throw new ConvexError("APP_NOT_SEEDED");
    }

    const user = await ctx.db.get(userId);
    const timezone = user?.timezone ?? "UTC";
    const systemPrompt = buildSessionPrompt({
      basePrompt: persona.systemPrompt,
      mode,
      memories: await selectPromptMemories(ctx, userId, app._id),
      recentSummaries: await selectRecentSummaries(ctx, userId, app._id, timezone),
      focus: trimmedFocus,
    });

    const callId = await ctx.db.insert("calls", {
      userId,
      appId: app._id,
      personaId: persona._id,
      mode,
      channel: "web",
      status: "queued",
      focus: trimmedFocus,
      sensitive: persona.isSensitive,
    });

    return {
      callId,
      assistantId: persona.vapiAssistantId,
      assistantOverrides: {
        firstMessage: persona.firstMessage,
        maxDurationSeconds: Math.min(
          SESSION_MODES[mode].maxDurationSeconds,
          persona.maxCallSeconds,
        ),
        model: {
          provider: persona.llmProvider,
          model: persona.llmModel,
          messages: [{ role: "system" as const, content: systemPrompt }],
        },
        startSpeakingPlan: REMI_START_SPEAKING_PLAN,
        metadata: { call_id: callId },
      },
    };
  },
});

// Forward-only status moves the browser may report. The webhook and the
// processor own "processing" → "completed" / "failed".
const CLIENT_TRANSITIONS: Record<string, readonly Doc<"calls">["status"][]> = {
  connecting: ["queued"],
  in_session: ["queued", "connecting"],
  processing: ["queued", "connecting", "in_session"],
  failed: ["queued", "connecting"],
};

export const reportClientStatus = mutation({
  args: {
    callId: v.id("calls"),
    status: v.union(
      v.literal("connecting"),
      v.literal("in_session"),
      v.literal("processing"),
      v.literal("failed"),
    ),
    vapiCallId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, { callId, status, vapiCallId, errorMessage }) => {
    const userId = await requireUserId(ctx);
    const call = await getOwnedCall(ctx, userId, callId);

    if (vapiCallId !== undefined) {
      if (call.vapiCallId !== undefined && call.vapiCallId !== vapiCallId) {
        throw new ConvexError("VAPI_CALL_ID_MISMATCH");
      }
      if (call.vapiCallId === undefined) {
        const clash = await ctx.db
          .query("calls")
          .withIndex("by_vapi_call_id", (q) => q.eq("vapiCallId", vapiCallId))
          .first();
        if (clash !== null) throw new ConvexError("VAPI_CALL_ID_MISMATCH");
        await ctx.db.patch(callId, { vapiCallId });
      }
    }

    // Stale or out-of-order updates (e.g. the webhook already landed) are ignored.
    if (!CLIENT_TRANSITIONS[status].includes(call.status)) return publicCall(call);

    const patch: Partial<Doc<"calls">> = { status };
    if (status === "in_session" && call.startedAt === undefined) patch.startedAt = Date.now();
    if (status === "failed") patch.endReason = (errorMessage ?? "client-error").slice(0, 200);
    await ctx.db.patch(callId, patch);
    if (status === "processing") {
      await ctx.scheduler.runAfter(REPORT_TIMEOUT_MS, internal.calls.failIfNoReport, { callId });
    }
    return publicCall({ ...call, ...patch });
  },
});

export const failIfNoReport = internalMutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const call = await ctx.db.get(callId);
    if (call === null || call.reportReceivedAt !== undefined) return;
    if (call.status !== "processing") return;
    await ctx.db.patch(callId, {
      status: "failed",
      endReason: "no-end-of-call-report",
    });
  },
});

export const get = query({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const userId = await requireUserId(ctx);
    const call = await getOwnedCall(ctx, userId, callId);
    return { ...publicCall(call), processingError: call.processingError ?? null };
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const calls = await ctx.db
      .query("calls")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(25);
    return calls.map(publicCall);
  },
});
