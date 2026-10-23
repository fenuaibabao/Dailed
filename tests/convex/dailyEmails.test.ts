import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { VALID_DAILY_SETUP } from "../fixtures/dailySetup";
import { grantConsent, insertCall, newTest, seedApp, signedInAs, type TestConvex } from "./helpers";

// Monday 2026-10-19, 9:15am in Chicago: inside the fixture's weekday window.
const IN_WINDOW = Date.parse("2026-10-19T14:15:00Z");
const ENV_KEYS = [
  "DAILY_EMAILS_ENABLED",
  "RESEND_API_KEY",
  "DAILY_EMAIL_FROM",
  "DAILY_CALLS_ENABLED",
  "DAILY_ALLOWED_NUMBERS",
  "SPEND_CAP_USD_PER_DAY",
];

let fetchSpy: import("vitest").MockInstance<typeof fetch>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(IN_WINDOW);
  fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => new Response(JSON.stringify({ data: [{ id: "em_1" }] }), { status: 200 }));
});
afterEach(() => {
  vi.useRealTimers();
  fetchSpy.mockRestore();
  for (const key of ENV_KEYS) delete process.env[key];
});

function emailsOn() {
  process.env.DAILY_EMAILS_ENABLED = "1";
  process.env.RESEND_API_KEY = "re_test";
  process.env.DAILY_EMAIL_FROM = "Daily <daily@example.com>";
}

async function setUp(t: TestConvex) {
  await seedApp(t);
  const { userId, client } = await signedInAs(t);
  await client.mutation(api.daily.saveSetup, VALID_DAILY_SETUP);
  const recipient = await t.run(async (ctx) => (await ctx.db.query("careRecipients").collect())[0]);
  await t.run((ctx) => ctx.db.patch(recipient._id, { callConsent: "granted" }));
  return { userId, client, recipient };
}

async function answeredCall(t: TestConvex, recipientId: Id<"careRecipients">) {
  return await t.run(async (ctx) => {
    const app = (await ctx.db.query("apps").withIndex("by_slug", (q) => q.eq("slug", "daily")).unique())!;
    const recipient = (await ctx.db.get(recipientId))!;
    const circle = (await ctx.db.get(recipient.circleId))!;
    return await ctx.db.insert("calls", {
      userId: circle.ownerId,
      appId: app._id,
      personaId: app.defaultPersonaId!,
      mode: "quick",
      channel: "phone",
      status: "processing",
      sensitive: false,
      recipientId,
      localDate: "2026-10-19",
      attempt: 1,
      isConsentCall: false,
      dialedE164: recipient.phoneE164,
      transcript: "AI: Hi Mom\nUser: I fell in the kitchen, and say hi to Sam",
      durationSeconds: 300,
    });
  });
}

const OUTCOME = {
  consent: "unchanged" as const,
  consentQuote: null,
  stopRequested: false,
  mood: "cheerful",
  highlights: ["Talked about the tomatoes."],
  checkIns: [],
  passOn: "Says hi to Sam.",
  concerns: [{ label: "a fall", quote: "I fell in the kitchen" }],
  memories: [],
};

async function runScheduled(t: TestConvex) {
  await t.finishInProgressScheduledFunctions();
  await vi.runOnlyPendingTimersAsync();
  await t.finishInProgressScheduledFunctions();
}

type Batch = { key: string; emails: { to: string[]; subject: string; text: string }[] };

function sentBatches(): Batch[] {
  return fetchSpy.mock.calls
    .filter(([url]) => String(url) === "https://api.resend.com/emails/batch")
    .map(([, init]) => ({
      key: (init?.headers as Record<string, string>)["Idempotency-Key"],
      emails: JSON.parse(String(init?.body)) as { to: string[]; subject: string; text: string }[],
    }));
}

describe("family emails", () => {
  test("nothing is sent while emails are off, and nothing is marked sent", async () => {
    const t = newTest();
    const { recipient } = await setUp(t);
    const callId = await answeredCall(t, recipient._id);
    await t.mutation(internal.dailyCalls.saveOutcome, { callId, outcome: OUTCOME });
    await runScheduled(t);

    expect(sentBatches()).toEqual([]);
    const alerts = await t.run((ctx) => ctx.db.query("alerts").collect());
    expect(alerts.every((a) => a.sentAt === undefined)).toBe(true);
  });

  test("once on, the alert and the summary go to each family member separately", async () => {
    const t = newTest();
    emailsOn();
    const { recipient } = await setUp(t);
    const callId = await answeredCall(t, recipient._id);
    await t.mutation(internal.dailyCalls.saveOutcome, { callId, outcome: OUTCOME });
    await runScheduled(t);

    const batches = sentBatches();
    expect(batches).toHaveLength(2);
    const alert = batches.find((b) => b.key.startsWith("daily-alert-"))!;
    const summary = batches.find((b) => b.key.startsWith("daily-summary-"))!;
    expect(alert.emails.map((e) => e.to)).toEqual([["ada@example.com"], ["sam@example.com"]]);
    expect(alert.emails[0].subject).toBe("Please check in with Mom");
    expect(summary.emails[0].subject).toBe("Mom has a message for you");
    expect(summary.emails[1].text).toContain("added you to");
    // Never the transcript.
    expect(JSON.stringify(batches)).not.toContain("AI: Hi Mom");

    const [savedAlert] = await t.run((ctx) => ctx.db.query("alerts").collect());
    const [savedSummary] = await t.run((ctx) => ctx.db.query("callSummaries").collect());
    expect(savedAlert.sentAt).toBeDefined();
    expect(savedSummary.emailedAt).toBeDefined();

    // Running a send again doesn't email twice.
    await t.action(internal.dailyEmails.sendAlert, { alertId: savedAlert._id });
    expect(sentBatches()).toHaveLength(2);
  });

  test("family members who turned alerts off don't get them", async () => {
    const t = newTest();
    emailsOn();
    const { recipient } = await setUp(t);
    await t.run(async (ctx) => {
      const sam = (await ctx.db.query("circleMembers").collect()).find((m) => m.email === "sam@example.com")!;
      await ctx.db.patch(sam._id, { getsAlerts: false });
    });
    const callId = await answeredCall(t, recipient._id);
    await t.mutation(internal.dailyCalls.saveOutcome, { callId, outcome: OUTCOME });
    await runScheduled(t);
    const alert = sentBatches().find((b) => b.key.startsWith("daily-alert-"))!;
    expect(alert.emails.map((e) => e.to)).toEqual([["ada@example.com"]]);
  });

  test("a refused send stays unsent so it can be retried", async () => {
    const t = newTest();
    emailsOn();
    fetchSpy.mockImplementation(async () => new Response("{}", { status: 500 }));
    const { recipient } = await setUp(t);
    const callId = await answeredCall(t, recipient._id);
    await t.mutation(internal.dailyCalls.saveOutcome, { callId, outcome: OUTCOME });
    await runScheduled(t);
    const [savedAlert] = await t.run((ctx) => ctx.db.query("alerts").collect());
    expect(savedAlert.sentAt).toBeUndefined();
  });
});

describe("the spend cap", () => {
  test("stops the Daily scheduler once the last 24 hours reach the cap", async () => {
    const t = newTest();
    await setUp(t);
    process.env.DAILY_CALLS_ENABLED = "1";
    process.env.DAILY_ALLOWED_NUMBERS = "+15551234567";
    await t.run(async (ctx) => {
      const recipient = (await ctx.db.query("careRecipients").collect())[0];
      await ctx.db.patch(recipient._id, { callConsent: "not_asked" });
    });
    process.env.SPEND_CAP_USD_PER_DAY = "5";
    const { userId } = await signedInAs(t, "Bo");
    const big = await insertCall(t, userId, { status: "completed" });
    await t.run((ctx) => ctx.db.patch(big, { costUsd: 6 }));
    expect(await t.mutation(internal.dailyCalls.tick, {})).toEqual({ queued: 0 });

    process.env.SPEND_CAP_USD_PER_DAY = "50";
    expect(await t.mutation(internal.dailyCalls.tick, {})).toEqual({ queued: 1 });
  });

  test("stops new browser sessions too, with a clear reason", async () => {
    const t = newTest();
    await seedApp(t);
    const { userId, client } = await signedInAs(t);
    await grantConsent(t, userId);
    process.env.SPEND_CAP_USD_PER_DAY = "1";
    const earlier = await insertCall(t, userId, { status: "completed" });
    await t.run((ctx) => ctx.db.patch(earlier, { costUsd: 1.5 }));
    await expect(client.mutation(api.calls.start, {})).rejects.toThrow("SPEND_CAP_REACHED");
  });
});
