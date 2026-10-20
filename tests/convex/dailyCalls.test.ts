import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { DailyOutcome } from "../../convex/lib/dailyProcessing";
import { VALID_DAILY_SETUP } from "../fixtures/dailySetup";
import { newTest, seedApp, signedInAs, type TestConvex } from "./helpers";

const SECRET = "whsec_test";
const MOM = "+15551234567";
// Monday 2026-10-19, 9:15am in Chicago: inside the fixture's 9–10am weekday window.
const IN_WINDOW = Date.parse("2026-10-19T14:15:00Z");
const ENV_KEYS = [
  "DAILY_CALLS_ENABLED",
  "DAILY_ALLOWED_NUMBERS",
  "DAILY_ALLOW_ALL_NUMBERS",
  "VAPI_WEBHOOK_SECRET",
  "VAPI_PRIVATE_KEY",
  "VAPI_PHONE_NUMBER_ID",
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(IN_WINDOW);
  process.env.VAPI_WEBHOOK_SECRET = SECRET;
});
afterEach(() => {
  vi.useRealTimers();
  for (const key of ENV_KEYS) delete process.env[key];
});

function switchOn(numbers = MOM) {
  process.env.DAILY_CALLS_ENABLED = "1";
  process.env.DAILY_ALLOWED_NUMBERS = numbers;
}

async function setUp(t: TestConvex) {
  await seedApp(t);
  const { userId, client } = await signedInAs(t);
  await client.mutation(api.daily.saveSetup, VALID_DAILY_SETUP);
  const recipient = await t.run(async (ctx) => (await ctx.db.query("careRecipients").collect())[0]);
  return { userId, client, recipient };
}

async function dailyCalls(t: TestConvex) {
  return await t.run((ctx) => ctx.db.query("calls").filter((q) => q.neq(q.field("recipientId"), undefined)).collect());
}

/** Inserts a placed Daily call, as tick() + markPlaced() would leave it. */
async function placedCall(
  t: TestConvex,
  recipientId: Id<"careRecipients">,
  fields: { isConsentCall?: boolean; at?: number; localDate?: string; dialed?: string } = {},
) {
  if (fields.at !== undefined) vi.setSystemTime(fields.at);
  const callId = await t.run(async (ctx) => {
    const app = (await ctx.db.query("apps").withIndex("by_slug", (q) => q.eq("slug", "daily")).unique())!;
    const recipient = (await ctx.db.get(recipientId))!;
    const circle = (await ctx.db.get(recipient.circleId))!;
    return await ctx.db.insert("calls", {
      userId: circle.ownerId,
      appId: app._id,
      personaId: app.defaultPersonaId!,
      mode: "quick",
      channel: "phone",
      status: "connecting",
      sensitive: false,
      recipientId,
      localDate: fields.localDate ?? "2026-10-19",
      attempt: 1,
      isConsentCall: fields.isConsentCall ?? false,
      dialedE164: fields.dialed ?? MOM,
      vapiCallId: `vc_${Math.random()}`,
    });
  });
  vi.setSystemTime(IN_WINDOW);
  return callId;
}

async function report(t: TestConvex, callId: Id<"calls">, fields: { endedReason: string; transcript?: string }) {
  return await t.mutation(api.vapiWebhook.recordEndOfCallReport, {
    secret: SECRET,
    report: { callId, durationSeconds: 240, ...fields },
  });
}

const OUTCOME: DailyOutcome = {
  consent: "unchanged",
  consentQuote: null,
  stopRequested: false,
  mood: "cheerful",
  highlights: ["Talked about the tomatoes."],
  checkIns: ["Said she took her morning pills."],
  passOn: "Says hi to Sam.",
  concerns: [],
  memories: [{ content: "Grows tomatoes", importance: 3 }],
};

async function finish(t: TestConvex, callId: Id<"calls">, outcome: Partial<DailyOutcome> = {}) {
  await t.run((ctx) => ctx.db.patch(callId, { status: "processing", transcript: "AI: Hi\nUser: Hello" }));
  await t.mutation(internal.dailyCalls.saveOutcome, { callId, outcome: { ...OUTCOME, ...outcome } });
}

async function setConsent(t: TestConvex, recipientId: Id<"careRecipients">, callConsent: "granted" | "not_asked") {
  await t.run((ctx) => ctx.db.patch(recipientId, { callConsent }));
}

describe("the Daily scheduler", () => {
  test("does nothing unless switched on, and only calls numbers on the test list", async () => {
    const t = newTest();
    await setUp(t);
    expect(await t.mutation(internal.dailyCalls.tick, {})).toEqual({ queued: 0 });

    switchOn("+15550000000");
    expect(await t.mutation(internal.dailyCalls.tick, {})).toEqual({ queued: 0 });
    expect(await dailyCalls(t)).toHaveLength(0);
  });

  test("queues one call in the window, asking for consent the first time, and not twice", async () => {
    const t = newTest();
    const { userId } = await setUp(t);
    switchOn();
    expect(await t.mutation(internal.dailyCalls.tick, {})).toEqual({ queued: 1 });
    expect(await t.mutation(internal.dailyCalls.tick, {})).toEqual({ queued: 0 });

    const [call] = await dailyCalls(t);
    expect(call).toMatchObject({
      userId,
      channel: "phone",
      status: "queued",
      localDate: "2026-10-19",
      attempt: 1,
      isConsentCall: true,
      dialedE164: MOM,
    });
  });

  test("skips paused schedules and parents who said no", async () => {
    const t = newTest();
    const { client, recipient } = await setUp(t);
    switchOn();
    await client.mutation(api.daily.setPaused, { paused: true });
    expect(await t.mutation(internal.dailyCalls.tick, {})).toEqual({ queued: 0 });
    await client.mutation(api.daily.setPaused, { paused: false });
    await t.run((ctx) => ctx.db.patch(recipient._id, { callConsent: "declined" }));
    expect(await t.mutation(internal.dailyCalls.tick, {})).toEqual({ queued: 0 });
  });

  test("placing without Vapi set up fails safely and dials no one", async () => {
    const t = newTest();
    await setUp(t);
    switchOn();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await t.mutation(internal.dailyCalls.tick, {});
    await t.finishInProgressScheduledFunctions();
    await vi.runOnlyPendingTimersAsync();
    await t.finishInProgressScheduledFunctions();
    const [call] = await dailyCalls(t);
    expect(call).toMatchObject({ status: "failed", endReason: "vapi-not-configured" });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  test("dials through Vapi with the parent's number and our call id", async () => {
    const t = newTest();
    await setUp(t);
    switchOn();
    process.env.VAPI_PRIVATE_KEY = "test-key";
    process.env.VAPI_PHONE_NUMBER_ID = "pn_test";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ id: "vc_123" }), { status: 201 }));
    await t.mutation(internal.dailyCalls.tick, {});
    await t.finishInProgressScheduledFunctions();
    await vi.runOnlyPendingTimersAsync();
    await t.finishInProgressScheduledFunctions();

    const [call] = await dailyCalls(t);
    expect(call).toMatchObject({ status: "connecting", vapiCallId: "vc_123" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.vapi.ai/call");
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      phoneNumberId: "pn_test",
      customer: { number: MOM },
      assistantOverrides: { metadata: { call_id: call._id } },
    });
    expect(body.assistantOverrides.firstMessage).toContain("Is it OK if I call you each day?");
    fetchSpy.mockRestore();
  });
});

describe("after a Daily call", () => {
  test("an unanswered call is missed, and two in a row alert the family once", async () => {
    const t = newTest();
    const { client, recipient } = await setUp(t);
    const first = await placedCall(t, recipient._id, { at: IN_WINDOW - 3 * 86_400_000, localDate: "2026-10-16" });
    expect(await report(t, first, { endedReason: "customer-did-not-answer" })).toEqual({ outcome: "updated" });
    expect(await t.run((ctx) => ctx.db.get(first))).toMatchObject({ status: "missed" });
    expect(await client.query(api.daily.myAlerts, {})).toEqual([]);

    const second = await placedCall(t, recipient._id, { at: IN_WINDOW - 86_400_000, localDate: "2026-10-18" });
    await report(t, second, { endedReason: "voicemail", transcript: "AI: Hi\nUser: Leave a message" });
    const third = await placedCall(t, recipient._id, { localDate: "2026-10-19" });
    await report(t, third, { endedReason: "customer-busy" });

    const alerts = await client.query(api.daily.myAlerts, {});
    expect(alerts.map((a) => a.kind)).toEqual(["no_answer_twice"]);
    expect(alerts[0].message).toBe("Mom didn't answer the last two calls.");
  });

  test("an answered call is read; the family sees the summary, not the transcript", async () => {
    const t = newTest();
    const { userId, client, recipient } = await setUp(t);
    await setConsent(t, recipient._id, "granted");
    const callId = await placedCall(t, recipient._id);
    await report(t, callId, { endedReason: "customer-ended-call", transcript: "AI: Hi Mom\nUser: Hello dear" });
    expect(await t.run((ctx) => ctx.db.get(callId))).toMatchObject({ status: "processing" });

    await t.mutation(internal.dailyCalls.saveOutcome, { callId, outcome: OUTCOME });
    expect(await t.run((ctx) => ctx.db.get(callId))).toMatchObject({ status: "completed" });
    expect(await client.query(api.daily.myCalls, {})).toEqual([
      {
        at: expect.any(Number),
        answered: true,
        durationSeconds: 240,
        mood: "cheerful",
        highlights: ["Talked about the tomatoes."],
        checkIns: ["Said she took her morning pills."],
        passOn: "Says hi to Sam.",
      },
    ]);

    // The parent's words stay out of the child's sessions and export.
    expect(await client.query(api.calls.listMine, {})).toEqual([]);
    const exported = await client.mutation(api.privacy.exportMine, {});
    expect(exported.sessions[0].transcript).toBeNull();
    expect(exported.memories).toEqual([]);
    expect(exported.dailyHistory?.calls).toHaveLength(1);
    const memories = await t.run((ctx) => ctx.db.query("memories").collect());
    expect(memories).toMatchObject([{ userId, content: "Grows tomatoes", sensitive: false }]);
  });

  test("a clear yes on the first call is recorded as the parent's consent", async () => {
    const t = newTest();
    const { client, recipient } = await setUp(t);
    const callId = await placedCall(t, recipient._id, { isConsentCall: true });
    await finish(t, callId, { consent: "granted", consentQuote: "sure, that's fine" });

    expect((await client.query(api.daily.mySetup, {}))?.callConsent).toBe("granted");
    const records = await t.run((ctx) => ctx.db.query("callConsentRecords").collect());
    expect(records).toMatchObject([
      { decision: "granted", phoneE164: MOM, parentWords: "sure, that's fine", callId },
    ]);
    expect(records[0].consentText).toContain("Is it OK if I call you each day?");
    expect(await client.query(api.daily.myCalls, {})).toHaveLength(1);
  });

  test("a no stops the calls, tells the family, and shares nothing else", async () => {
    const t = newTest();
    const { client, recipient } = await setUp(t);
    const callId = await placedCall(t, recipient._id, { isConsentCall: true });
    await finish(t, callId, { consent: "declined" });

    expect((await client.query(api.daily.mySetup, {}))?.callConsent).toBe("declined");
    expect((await client.query(api.daily.myAlerts, {})).map((a) => a.kind)).toEqual(["declined"]);
    expect(await t.run((ctx) => ctx.db.query("callSummaries").collect())).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("memories").collect())).toEqual([]);
  });

  test("no clear answer pauses the calls until the family resumes them", async () => {
    const t = newTest();
    const { client, recipient } = await setUp(t);
    const callId = await placedCall(t, recipient._id, { isConsentCall: true });
    await finish(t, callId, { consent: "unclear" });

    expect(await client.query(api.daily.mySetup, {})).toMatchObject({ callConsent: "not_asked", paused: true });
    expect((await client.query(api.daily.myAlerts, {})).map((a) => a.kind)).toEqual(["unclear"]);
  });

  test("a yes only counts for the number that was called", async () => {
    const t = newTest();
    const { client, recipient } = await setUp(t);
    const callId = await placedCall(t, recipient._id, { isConsentCall: true, dialed: "+15550001111" });
    await finish(t, callId, { consent: "granted", consentQuote: "sure" });
    expect((await client.query(api.daily.mySetup, {}))?.callConsent).toBe("not_asked");
  });

  test("'stop calling me' revokes consent and tells the family", async () => {
    const t = newTest();
    const { client, recipient } = await setUp(t);
    await setConsent(t, recipient._id, "granted");
    const callId = await placedCall(t, recipient._id);
    await finish(t, callId, { stopRequested: true });

    expect((await client.query(api.daily.mySetup, {}))?.callConsent).toBe("revoked");
    expect((await client.query(api.daily.myAlerts, {})).map((a) => a.kind)).toEqual(["stopped"]);
    switchOn();
    expect(await t.mutation(internal.dailyCalls.tick, {})).toEqual({ queued: 0 });
  });

  test("worrying words become an alert with the parent's words", async () => {
    const t = newTest();
    const { client, recipient } = await setUp(t);
    await setConsent(t, recipient._id, "granted");
    const callId = await placedCall(t, recipient._id);
    await finish(t, callId, { concerns: [{ label: "a fall", quote: "I fell in the kitchen" }] });

    const [alert] = await client.query(api.daily.myAlerts, {});
    expect(alert).toMatchObject({ kind: "concern" });
    expect(alert.message).toContain('Mom mentioned a fall. They said: "I fell in the kitchen"');
  });

  test("other people can't see a family's calls or alerts", async () => {
    const t = newTest();
    const { recipient } = await setUp(t);
    await setConsent(t, recipient._id, "granted");
    const callId = await placedCall(t, recipient._id);
    await finish(t, callId, { concerns: [{ label: "a fall", quote: "I fell" }] });
    const other = await signedInAs(t, "Eve");
    expect(await other.client.query(api.daily.myCalls, {})).toEqual([]);
    expect(await other.client.query(api.daily.myAlerts, {})).toEqual([]);
  });
});
