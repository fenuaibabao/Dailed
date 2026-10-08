import { describe, expect, test } from "vitest";
import { parseVapiWebhook } from "../../src/lib/vapi/endOfCallReport";
import { verifyVapiSecret } from "../../src/lib/vapi/webhookAuth";

describe("verifyVapiSecret", () => {
  test("accepts the x-vapi-secret header or a Bearer token", () => {
    expect(verifyVapiSecret(new Headers({ "x-vapi-secret": "s3cret" }), "s3cret")).toBe("s3cret");
    expect(verifyVapiSecret(new Headers({ authorization: "Bearer s3cret" }), "s3cret")).toBe("s3cret");
  });
  test("rejects wrong, missing or unconfigured secrets", () => {
    expect(verifyVapiSecret(new Headers({ "x-vapi-secret": "nope" }), "s3cret")).toBeNull();
    expect(verifyVapiSecret(new Headers(), "s3cret")).toBeNull();
    expect(verifyVapiSecret(new Headers({ "x-vapi-secret": "" }), "")).toBeNull();
    expect(verifyVapiSecret(new Headers({ "x-vapi-secret": "anything" }), undefined)).toBeNull();
  });
});

describe("parseVapiWebhook", () => {
  test("normalizes an end-of-call report, preferring artifact fields", () => {
    const parsed = parseVapiWebhook({
      message: {
        type: "end-of-call-report",
        endedReason: "customer-ended-call",
        cost: 0.42,
        startedAt: "2026-10-08T10:00:00.000Z",
        endedAt: "2026-10-08T10:05:30.000Z",
        transcript: "old location",
        artifact: { transcript: "User: hello", recordingUrl: "https://rec" },
        call: { id: "vapi-1", assistantOverrides: { metadata: { call_id: "abc123" } } },
        somethingNew: { ignored: true },
      },
    });
    expect(parsed).toEqual({
      kind: "end-of-call-report",
      report: {
        callId: "abc123",
        vapiCallId: "vapi-1",
        transcript: "User: hello",
        recordingUrl: "https://rec",
        durationSeconds: 330,
        costUsd: 0.42,
        endedReason: "customer-ended-call",
        startedAt: Date.parse("2026-10-08T10:00:00.000Z"),
        endedAt: Date.parse("2026-10-08T10:05:30.000Z"),
      },
    });
  });

  test("finds call_id in call.metadata or assistant.metadata too", () => {
    const a = parseVapiWebhook({ message: { type: "end-of-call-report", call: { id: "v", metadata: { call_id: "x" } } } });
    const b = parseVapiWebhook({ message: { type: "end-of-call-report", assistant: { metadata: { call_id: "y" } } } });
    expect(a.kind === "end-of-call-report" && a.report.callId).toBe("x");
    expect(b.kind === "end-of-call-report" && b.report.callId).toBe("y");
  });

  test("passes other message types through as ignorable, and rejects junk", () => {
    expect(parseVapiWebhook({ message: { type: "status-update" } })).toEqual({ kind: "other", type: "status-update" });
    expect(parseVapiWebhook({ nope: true })).toEqual({ kind: "invalid" });
    expect(parseVapiWebhook(null)).toEqual({ kind: "invalid" });
  });
});
