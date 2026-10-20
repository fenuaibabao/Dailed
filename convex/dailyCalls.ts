import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { audit } from "./lib/audit";
import { buildDailyPrompt, consentOpening, dailyFirstMessage, DAILY_MAX_CALL_SECONDS } from "./lib/dailyPrompt";
import { processDailyTranscript, type DailyOutcome } from "./lib/dailyProcessing";
import { buildVapiCallRequest, VAPI_CALL_URL, vapiCallIdFrom } from "./lib/dailyVapi";
import { getLlmProvider } from "./lib/llm";
import { selectPromptMemories } from "./lib/promptContext";
import { redact } from "./lib/redaction";
import type { PromptSummary } from "./lib/sessionPrompt";
import { decideCall, isNumberAllowed, localClock, NOT_ANSWERED_REASONS } from "../src/lib/dailySchedule";

// Daily's phone calls (docs/PRIMER.md, roadmap item 4 and "The daily call").
//
// Safety switches, all Convex environment variables, all off by default:
// - DAILY_CALLS_ENABLED=1 turns the scheduler on. Without it nothing dials.
// - DAILY_ALLOWED_NUMBERS lists the only numbers it may call while testing.
// - DAILY_ALLOW_ALL_NUMBERS=1 lifts that list, for the pilot.
// Placing a call also needs VAPI_PRIVATE_KEY and VAPI_PHONE_NUMBER_ID (a paid
// Twilio number imported into Vapi; Vapi rejects trial numbers).

/** If no end-of-call report arrives this long after placing a call, it's marked failed. */
export const REPORT_GRACE_MS = 15 * 60 * 1000;

function env() {
  return {
    enabled: process.env.DAILY_CALLS_ENABLED === "1",
    numbers: { allowedNumbers: process.env.DAILY_ALLOWED_NUMBERS, allowAll: process.env.DAILY_ALLOW_ALL_NUMBERS },
  };
}

async function dailyApp(ctx: QueryCtx) {
  const app = await ctx.db
    .query("apps")
    .withIndex("by_slug", (q) => q.eq("slug", "daily"))
    .unique();
  const persona = app?.defaultPersonaId !== undefined ? await ctx.db.get(app.defaultPersonaId) : null;
  return app === null || persona === null ? null : { app, persona };
}

function isStopped(consent: Doc<"careRecipients">["callConsent"]) {
  return consent === "declined" || consent === "revoked";
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

/** Runs every few minutes (convex/crons.ts). Queues the calls that are due now. */
export const tick = internalMutation({
  args: {},
  handler: async (ctx) => {
    const { enabled, numbers } = env();
    if (!enabled) return { queued: 0 };
    const daily = await dailyApp(ctx);
    if (daily === null) return { queued: 0 };

    const now = Date.now();
    let queued = 0;
    const schedules = ctx.db.query("checkInSchedules").withIndex("by_paused", (q) => q.eq("paused", false));
    for await (const schedule of schedules) {
      const recipient = await ctx.db.get(schedule.recipientId);
      const circle = await ctx.db.get(schedule.circleId);
      if (recipient === null || circle === null || isStopped(recipient.callConsent)) continue;
      if (!isNumberAllowed(recipient.phoneE164, numbers)) continue;

      const clock = localClock(now, recipient.timezone);
      const today = await ctx.db
        .query("calls")
        .withIndex("by_recipient_date", (q) => q.eq("recipientId", recipient._id).eq("localDate", clock.dateKey))
        .collect();
      const decision = decideCall({
        now,
        timezone: recipient.timezone,
        days: schedule.daysOfWeek,
        windowStart: schedule.windowStart,
        windowEnd: schedule.windowEnd,
        todaysAttempts: today.map((c) => ({
          at: c._creationTime,
          unanswered: c.status === "missed" || c.status === "failed",
        })),
      });
      if (!decision.call) continue;

      const callId = await ctx.db.insert("calls", {
        userId: circle.ownerId,
        appId: daily.app._id,
        personaId: daily.persona._id,
        mode: "quick",
        channel: "phone",
        status: "queued",
        sensitive: false,
        recipientId: recipient._id,
        localDate: clock.dateKey,
        attempt: decision.attempt,
        isConsentCall: recipient.callConsent === "not_asked",
        dialedE164: recipient.phoneE164,
      });
      await audit(ctx, {
        action: "daily.call_placed",
        userId: circle.ownerId,
        targetId: callId,
        details: { attempt: decision.attempt, consentCall: recipient.callConsent === "not_asked" },
      });
      await ctx.scheduler.runAfter(0, internal.dailyCalls.place, { callId });
      queued++;
    }
    return { queued };
  },
});

/** Last few answered calls, as "date: highlights" lines for Remi's memory. */
async function recentSummaries(ctx: QueryCtx, circleId: Id<"careCircles">, timezone: string): Promise<PromptSummary[]> {
  const rows = await ctx.db
    .query("callSummaries")
    .withIndex("by_circle", (q) => q.eq("circleId", circleId))
    .order("desc")
    .take(3);
  return rows
    .filter((s) => s.highlights.length > 0)
    .map((s) => ({
      date: new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: timezone }).format(s.at),
      summary: s.highlights.join(" "),
    }));
}

/** Everything needed to dial, or null if the call shouldn't go ahead any more. */
export const loadPlacement = internalQuery({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const call = await ctx.db.get(callId);
    if (call === null || call.status !== "queued" || call.recipientId === undefined) return null;
    const recipient = await ctx.db.get(call.recipientId);
    if (recipient === null || isStopped(recipient.callConsent)) return null;
    const { enabled, numbers } = env();
    if (!enabled || !isNumberAllowed(recipient.phoneE164, numbers)) return null;
    const schedule = await ctx.db
      .query("checkInSchedules")
      .withIndex("by_recipient", (q) => q.eq("recipientId", recipient._id))
      .first();
    if (schedule === null || schedule.paused) return null;
    const persona = await ctx.db.get(call.personaId);
    const owner = await ctx.db.get(call.userId);
    if (persona === null) return null;

    const isConsentCall = recipient.callConsent === "not_asked";
    const childName = owner?.name ?? "";
    return {
      callId: call._id as string,
      assistantId: persona.vapiAssistantId,
      phoneE164: recipient.phoneE164,
      parentName: recipient.name,
      firstMessage: dailyFirstMessage({ parentName: recipient.name, childName, isConsentCall }),
      systemPrompt: buildDailyPrompt({
        parentName: recipient.name,
        childName,
        isConsentCall,
        talkAbout: recipient.talkAbout,
        avoid: recipient.avoid,
        checkItems: recipient.checkItems,
        memories: await selectPromptMemories(ctx, call.userId, call.appId),
        recentSummaries: await recentSummaries(ctx, recipient.circleId, recipient.timezone),
      }),
      provider: persona.llmProvider,
      model: persona.llmModel,
      maxDurationSeconds: Math.min(persona.maxCallSeconds, DAILY_MAX_CALL_SECONDS),
    };
  },
});

/** Asks Vapi to dial. Scheduled by tick(). */
export const place = internalAction({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const placement = await ctx.runQuery(internal.dailyCalls.loadPlacement, { callId });
    if (placement === null) {
      await ctx.runMutation(internal.dailyCalls.markPlaceFailed, { callId, reason: "cancelled-before-dialing" });
      return;
    }
    const key = process.env.VAPI_PRIVATE_KEY;
    const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
    if (!key || !phoneNumberId) {
      await ctx.runMutation(internal.dailyCalls.markPlaceFailed, { callId, reason: "vapi-not-configured" });
      return;
    }
    try {
      const response = await fetch(VAPI_CALL_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(buildVapiCallRequest(placement, phoneNumberId)),
      });
      const body: unknown = await response.json().catch(() => null);
      const vapiCallId = vapiCallIdFrom(body);
      if (!response.ok || vapiCallId === null) {
        // Vapi's error message helps debugging and holds no secrets; never log the request.
        const message = typeof body === "object" && body !== null ? String((body as { message?: unknown }).message ?? "") : "";
        console.error(`Daily: Vapi refused call ${callId} (${response.status}): ${message.slice(0, 200)}`);
        await ctx.runMutation(internal.dailyCalls.markPlaceFailed, { callId, reason: `vapi-${response.status}` });
        return;
      }
      await ctx.runMutation(internal.dailyCalls.markPlaced, { callId, vapiCallId });
    } catch (error) {
      console.error(`Daily: couldn't reach Vapi for call ${callId}: ${error instanceof Error ? error.message : ""}`);
      await ctx.runMutation(internal.dailyCalls.markPlaceFailed, { callId, reason: "vapi-unreachable" });
    }
  },
});

export const markPlaced = internalMutation({
  args: { callId: v.id("calls"), vapiCallId: v.string() },
  handler: async (ctx, { callId, vapiCallId }) => {
    const call = await ctx.db.get(callId);
    if (call === null || call.status !== "queued") return;
    await ctx.db.patch(callId, { status: "connecting", vapiCallId });
    await ctx.scheduler.runAfter(DAILY_MAX_CALL_SECONDS * 1000 + REPORT_GRACE_MS, internal.dailyCalls.expireIfNoReport, {
      callId,
    });
  },
});

/** Placing the call didn't work. Counts as unanswered, so the one retry still happens. */
export const markPlaceFailed = internalMutation({
  args: { callId: v.id("calls"), reason: v.string() },
  handler: async (ctx, { callId, reason }) => {
    const call = await ctx.db.get(callId);
    if (call === null || call.status !== "queued") return;
    await ctx.db.patch(callId, { status: "failed", endReason: reason.slice(0, 200), endedAt: Date.now() });
  },
});

export const expireIfNoReport = internalMutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const call = await ctx.db.get(callId);
    if (call === null || call.reportReceivedAt !== undefined) return;
    if (call.status !== "queued" && call.status !== "connecting" && call.status !== "in_session") return;
    await ctx.db.patch(callId, { status: "failed", endReason: "no-end-of-call-report", endedAt: Date.now() });
  },
});

// ---------------------------------------------------------------------------
// After a call
// ---------------------------------------------------------------------------

export type DailyReport = {
  vapiCallId?: string;
  transcript?: string;
  recordingUrl?: string;
  durationSeconds?: number;
  costUsd?: number;
  endedReason?: string;
  startedAt?: number;
  endedAt?: number;
};

/** True when Vapi's report shows a person picked up and spoke. */
export function wasAnswered(report: DailyReport): boolean {
  if (report.endedReason !== undefined && NOT_ANSWERED_REASONS.has(report.endedReason)) return false;
  return /^\s*(user|customer)\s*:\s*\S/im.test(report.transcript ?? "");
}

/**
 * Records Vapi's end-of-call report for a Daily call. Called from the webhook
 * mutation once it has matched the call; that mutation already checked the
 * secret and ignores duplicates.
 */
export async function recordDailyReport(ctx: MutationCtx, call: Doc<"calls">, report: DailyReport) {
  const answered = wasAnswered(report);
  const owner = await ctx.db.get(call.userId);
  const shouldRedact = owner?.redactTranscripts === true;
  const raw = report.transcript?.trim() ?? "";
  await ctx.db.patch(call._id, {
    vapiCallId: call.vapiCallId ?? report.vapiCallId,
    transcript: answered ? (shouldRedact ? redact(raw).text : raw) : undefined,
    recordingUrl: answered && !shouldRedact ? report.recordingUrl : undefined,
    durationSeconds: report.durationSeconds !== undefined ? Math.round(report.durationSeconds) : undefined,
    costUsd: report.costUsd,
    endReason: report.endedReason?.slice(0, 200),
    startedAt: report.startedAt ?? call.startedAt,
    endedAt: report.endedAt ?? Date.now(),
    reportReceivedAt: Date.now(),
    status: answered ? "processing" : "missed",
  });
  if (answered) {
    await ctx.scheduler.runAfter(0, internal.dailyCalls.processCall, { callId: call._id });
  } else if (call.recipientId !== undefined) {
    await alertIfMissedTwice(ctx, call.recipientId);
  }
}

async function addAlert(
  ctx: MutationCtx,
  recipient: Doc<"careRecipients">,
  kind: Doc<"alerts">["kind"],
  message: string,
  callId?: Id<"calls">,
) {
  await ctx.db.insert("alerts", { circleId: recipient.circleId, recipientId: recipient._id, callId, kind, message, at: Date.now() });
  const circle = await ctx.db.get(recipient.circleId);
  await audit(ctx, { action: "daily.alert", userId: circle?.ownerId, targetId: callId, details: { kind } });
}

/** Alerts the family once when two calls in a row go unanswered. Failed placements don't count. */
async function alertIfMissedTwice(ctx: MutationCtx, recipientId: Id<"careRecipients">) {
  const recipient = await ctx.db.get(recipientId);
  if (recipient === null) return;
  const recent: Doc<"calls">[] = [];
  const calls = ctx.db
    .query("calls")
    .withIndex("by_recipient_date", (q) => q.eq("recipientId", recipientId))
    .order("desc");
  for await (const call of calls) {
    if (call.status === "failed" || call.status === "queued") continue;
    recent.push(call);
    if (recent.length === 3) break;
  }
  const [last, before, earlier] = recent;
  // Fire on the second miss in a run, not on every miss after it.
  if (last?.status === "missed" && before?.status === "missed" && earlier?.status !== "missed") {
    await addAlert(ctx, recipient, "no_answer_twice", `${recipient.name} didn't answer the last two calls.`, last._id);
  }
}

export const loadProcessJob = internalQuery({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const call = await ctx.db.get(callId);
    if (call === null || call.status !== "processing" || !call.transcript || call.recipientId === undefined) return null;
    const recipient = await ctx.db.get(call.recipientId);
    const persona = await ctx.db.get(call.personaId);
    if (recipient === null || persona === null) return null;
    return {
      transcript: call.transcript,
      parentName: recipient.name,
      isConsentCall: call.isConsentCall === true,
      provider: persona.llmProvider,
      model: persona.llmModel,
    };
  },
});

/** Reads a finished call: the parent's answer, the family summary, alerts and memories. */
export const processCall = internalAction({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const job = await ctx.runQuery(internal.dailyCalls.loadProcessJob, { callId });
    if (job === null) return;
    try {
      const outcome = await processDailyTranscript(getLlmProvider(job.provider), job.model, job);
      await ctx.runMutation(internal.dailyCalls.saveOutcome, { callId, outcome });
    } catch (error) {
      console.error(`Daily: processing failed for call ${callId}: ${error instanceof Error ? error.message : ""}`);
      await ctx.runMutation(internal.processor.markFailed, {
        callId,
        reason: "We couldn't read this call. The family summary is missing for it.",
      });
    }
  },
});

const outcomeValidator = v.object({
  consent: v.union(v.literal("granted"), v.literal("declined"), v.literal("unclear"), v.literal("unchanged")),
  consentQuote: v.union(v.string(), v.null()),
  stopRequested: v.boolean(),
  mood: v.union(v.string(), v.null()),
  highlights: v.array(v.string()),
  checkIns: v.array(v.string()),
  passOn: v.union(v.string(), v.null()),
  concerns: v.array(v.object({ label: v.string(), quote: v.union(v.string(), v.null()) })),
  memories: v.array(v.object({ content: v.string(), importance: v.number() })),
});

async function recordConsent(
  ctx: MutationCtx,
  call: Doc<"calls">,
  recipient: Doc<"careRecipients">,
  decision: Doc<"callConsentRecords">["decision"],
  consentText: string,
  parentWords: string | null,
) {
  await ctx.db.patch(recipient._id, { callConsent: decision });
  await ctx.db.insert("callConsentRecords", {
    recipientId: recipient._id,
    circleId: recipient.circleId,
    phoneE164: recipient.phoneE164,
    decision,
    consentText,
    parentWords: parentWords ?? undefined,
    callId: call._id,
    at: Date.now(),
  });
  await audit(ctx, { action: "daily.consent", userId: call.userId, targetId: call._id, details: { decision } });
}

export const saveOutcome = internalMutation({
  args: { callId: v.id("calls"), outcome: outcomeValidator },
  handler: async (ctx, { callId, outcome }: { callId: Id<"calls">; outcome: DailyOutcome }) => {
    const call = await ctx.db.get(callId);
    if (call === null || call.status !== "processing" || call.recipientId === undefined) return;
    const recipient = await ctx.db.get(call.recipientId);
    if (recipient === null) return;
    const owner = await ctx.db.get(call.userId);
    const name = recipient.name;
    // A yes or no only counts for the number that was called.
    const sameNumber = call.dialedE164 === recipient.phoneE164;
    const asked = consentOpening(name, owner?.name ?? "");

    let consent = recipient.callConsent;
    if (call.isConsentCall && sameNumber && consent === "not_asked") {
      if (outcome.consent === "granted") {
        await recordConsent(ctx, call, recipient, "granted", asked, outcome.consentQuote);
        consent = "granted";
      } else if (outcome.consent === "declined") {
        await recordConsent(ctx, call, recipient, "declined", asked, outcome.consentQuote);
        consent = "declined";
        await addAlert(ctx, recipient, "declined", `${name} said no to the calls. They won't be called again.`, callId);
      } else {
        const schedule = await ctx.db
          .query("checkInSchedules")
          .withIndex("by_recipient", (q) => q.eq("recipientId", recipient._id))
          .first();
        if (schedule !== null && !schedule.paused) await ctx.db.patch(schedule._id, { paused: true });
        await addAlert(
          ctx,
          recipient,
          "unclear",
          `${name} didn't give a clear yes on the first call, so the calls are paused. Resume them if you'd like ${name} to be asked once more.`,
          callId,
        );
      }
    }
    if (outcome.stopRequested && consent === "granted" && sameNumber) {
      await recordConsent(ctx, call, recipient, "revoked", asked, null);
      consent = "revoked";
      await addAlert(ctx, recipient, "stopped", `${name} asked to stop the calls. They won't be called again.`, callId);
    }

    if (outcome.concerns.length > 0) {
      const labels = [...new Set(outcome.concerns.map((c) => c.label))].join(", ");
      const words = outcome.concerns.find((c) => c.quote !== null)?.quote;
      await addAlert(
        ctx,
        recipient,
        "concern",
        `On today's call, ${name} mentioned ${labels}.${words ? ` They said: "${words}"` : ""} Please check in with them.`,
        callId,
      );
    }

    // The family only hears about the call itself once the parent has said yes.
    if (consent === "granted" || consent === "revoked") {
      await ctx.db.insert("callSummaries", {
        callId,
        circleId: recipient.circleId,
        recipientId: recipient._id,
        at: call._creationTime,
        durationSeconds: call.durationSeconds,
        mood: outcome.mood ?? undefined,
        highlights: outcome.highlights,
        checkIns: outcome.checkIns,
        passOn: outcome.passOn ?? undefined,
      });
    }
    if (consent === "granted") {
      for (const memory of outcome.memories) {
        await ctx.db.insert("memories", {
          userId: call.userId,
          appId: call.appId,
          callId,
          kind: "fact",
          content: memory.content,
          importance: Math.min(5, Math.max(1, Math.round(memory.importance))),
          sensitive: false,
        });
      }
    }
    await ctx.db.patch(callId, { status: "completed", processingError: undefined });
  },
});
