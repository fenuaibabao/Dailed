import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { insertCall, newTest, signedInAs } from "./helpers";

const SECRET = "whsec_test";

beforeEach(() => {
  vi.useFakeTimers();
  process.env.VAPI_WEBHOOK_SECRET = SECRET;
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.VAPI_WEBHOOK_SECRET;
});

const report = {
  transcript: "AI: Hi, this is Remi.\nUser: I've been building a pottery studio for two years.",
  recordingUrl: "https://storage.vapi.ai/rec.wav",
  durationSeconds: 312.4,
  costUsd: 0.36,
  endedReason: "customer-ended-call",
  startedAt: 1_700_000_000_000,
  endedAt: 1_700_000_312_000,
};

describe("end-of-call webhook", () => {
  test("rejects a wrong or missing secret", async () => {
    const t = newTest();
    const { userId } = await signedInAs(t);
    const callId = await insertCall(t, userId, { status: "in_session" });
    await expect(
      t.mutation(api.vapiWebhook.recordEndOfCallReport, { secret: "nope", report: { callId, ...report } }),
    ).rejects.toThrow("INVALID_WEBHOOK_SECRET");

    delete process.env.VAPI_WEBHOOK_SECRET;
    await expect(
      t.mutation(api.vapiWebhook.recordEndOfCallReport, { secret: "", report: { callId, ...report } }),
    ).rejects.toThrow("INVALID_WEBHOOK_SECRET");

    const row = await t.run((ctx) => ctx.db.get(callId));
    expect(row?.transcript).toBeUndefined();
  });

  test("updates the matching call and moves it to processing", async () => {
    const t = newTest();
    const { userId } = await signedInAs(t);
    const callId = await insertCall(t, userId, { status: "in_session", vapiCallId: "vapi-1" });
    const result = await t.mutation(api.vapiWebhook.recordEndOfCallReport, {
      secret: SECRET,
      report: { callId, vapiCallId: "vapi-1", ...report },
    });
    expect(result.outcome).toBe("updated");
    const row = await t.run((ctx) => ctx.db.get(callId));
    expect(row).toMatchObject({
      status: "processing",
      transcript: report.transcript,
      recordingUrl: report.recordingUrl,
      durationSeconds: 312,
      costUsd: 0.36,
      endReason: "customer-ended-call",
      startedAt: report.startedAt,
      endedAt: report.endedAt,
    });
  });

  test("is idempotent: a second delivery changes nothing", async () => {
    const t = newTest();
    const { userId } = await signedInAs(t);
    const callId = await insertCall(t, userId, { status: "in_session" });
    await t.mutation(api.vapiWebhook.recordEndOfCallReport, { secret: SECRET, report: { callId, ...report } });
    const first = await t.run((ctx) => ctx.db.get(callId));
    const again = await t.mutation(api.vapiWebhook.recordEndOfCallReport, {
      secret: SECRET,
      report: { callId, ...report, transcript: "User: something else entirely" },
    });
    expect(again.outcome).toBe("duplicate");
    expect(await t.run((ctx) => ctx.db.get(callId))).toEqual(first);
  });

  test("never creates a call from an unsolicited report", async () => {
    const t = newTest();
    const result = await t.mutation(api.vapiWebhook.recordEndOfCallReport, {
      secret: SECRET,
      report: { vapiCallId: "someone-elses-call", ...report },
    });
    expect(result.outcome).toBe("unknown_call");
    const malformed = await t.mutation(api.vapiWebhook.recordEndOfCallReport, {
      secret: SECRET,
      report: { callId: "not-a-real-id", ...report },
    });
    expect(malformed.outcome).toBe("unknown_call");
    expect(await t.run((ctx) => ctx.db.query("calls").collect())).toEqual([]);
  });

  test("matches by Vapi call id when metadata is missing", async () => {
    const t = newTest();
    const { userId } = await signedInAs(t);
    const callId = await insertCall(t, userId, { status: "processing", vapiCallId: "vapi-9" });
    const result = await t.mutation(api.vapiWebhook.recordEndOfCallReport, {
      secret: SECRET,
      report: { vapiCallId: "vapi-9", ...report },
    });
    expect(result.outcome).toBe("updated");
    expect((await t.run((ctx) => ctx.db.get(callId)))?.transcript).toBe(report.transcript);
  });

  test("won't update a call tied to a different Vapi call", async () => {
    const t = newTest();
    const { userId } = await signedInAs(t);
    const callId = await insertCall(t, userId, { status: "in_session", vapiCallId: "vapi-mine" });
    const result = await t.mutation(api.vapiWebhook.recordEndOfCallReport, {
      secret: SECRET,
      report: { callId, vapiCallId: "vapi-other", ...report },
    });
    expect(result.outcome).toBe("vapi_call_id_mismatch");
    expect((await t.run((ctx) => ctx.db.get(callId)))?.transcript).toBeUndefined();
  });

  test("a call with no transcript is marked failed and not processed", async () => {
    const t = newTest();
    const { userId } = await signedInAs(t);
    const callId = await insertCall(t, userId, { status: "in_session" });
    await t.mutation(api.vapiWebhook.recordEndOfCallReport, {
      secret: SECRET,
      report: { callId, ...report, transcript: "  " },
    });
    const row = await t.run((ctx) => ctx.db.get(callId));
    expect(row?.status).toBe("failed");
    expect(row?.processingError).toBeTruthy();
  });

  test("if no report arrives, a call left processing by the browser fails after the timeout", async () => {
    const t = newTest();
    const { userId, client } = await signedInAs(t);
    const callId = await insertCall(t, userId, { status: "in_session" });
    await client.mutation(api.calls.reportClientStatus, { callId, status: "processing" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const row = await t.run((ctx) => ctx.db.get(callId));
    expect(row).toMatchObject({ status: "failed", endReason: "no-end-of-call-report" });
  });
});
