import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { DAY_MS } from "../../convex/lib/retention";
import { insertCall, newTest, signedInAs, type TestConvex } from "./helpers";

const SECRET = "whsec_test";

beforeEach(() => {
  vi.useFakeTimers();
  process.env.VAPI_WEBHOOK_SECRET = SECRET;
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.VAPI_WEBHOOK_SECRET;
});

const REPORT = {
  transcript: "AI: How can I reach you?\nUser: Email me at ada@example.com or call +1 (555) 123-4567. We grew 40% in 2024.",
  recordingUrl: "https://storage.vapi.ai/rec.wav",
  durationSeconds: 200,
};

/** A finished session with outputs, a memory and a weave. */
async function finishedSession(t: TestConvex, userId: Id<"users">, extra: { orgId?: Id<"orgs"> } = {}) {
  const callId = await insertCall(t, userId, { status: "completed", transcript: "User: something private" });
  await t.run(async (ctx) => {
    const call = (await ctx.db.get(callId))!;
    await ctx.db.patch(callId, { orgId: extra.orgId, recordingUrl: "https://storage.vapi.ai/rec.wav" });
    await ctx.db.insert("outputs", { callId, userId, kind: "session_summary", body: "Private summary", status: "draft" });
    await ctx.db.insert("memories", {
      userId,
      appId: call.appId,
      callId,
      kind: "fact",
      content: "Private fact",
      importance: 3,
      sensitive: false,
    });
    const weaveId = await ctx.db.insert("weaves", {
      userId,
      appId: call.appId,
      title: "Topic",
      summary: "Private weave",
      sessionCount: 1,
      lastCallId: callId,
      updatedAt: Date.now(),
      sensitive: false,
    });
    await ctx.db.insert("weaveLinks", { weaveId, callId, userId, note: "note" });
  });
  return callId;
}

async function contentLeft(t: TestConvex, callId: Id<"calls">) {
  return await t.run(async (ctx) => {
    const call = await ctx.db.get(callId);
    const byCall = async (table: "outputs" | "memories" | "weaveLinks") =>
      (await ctx.db.query(table).collect()).filter((r) => r.callId === callId).length;
    return {
      transcript: call?.transcript ?? null,
      recordingUrl: call?.recordingUrl ?? null,
      purged: call?.purgedAt !== undefined,
      outputs: await byCall("outputs"),
      memories: await byCall("memories"),
      weaveLinks: await byCall("weaveLinks"),
      weaves: (await ctx.db.query("weaves").collect()).length,
    };
  });
}

const NOTHING_LEFT = { transcript: null, recordingUrl: null, purged: true, outputs: 0, memories: 0, weaveLinks: 0, weaves: 0 };

describe("redaction", () => {
  test("off by default: the transcript and recording are kept as they came", async () => {
    const t = newTest();
    const { userId } = await signedInAs(t);
    const callId = await insertCall(t, userId, { status: "in_session" });
    await t.mutation(api.vapiWebhook.recordEndOfCallReport, { secret: SECRET, report: { callId, ...REPORT } });
    const row = await t.run((ctx) => ctx.db.get(callId));
    expect(row).toMatchObject({ transcript: REPORT.transcript, recordingUrl: REPORT.recordingUrl });
  });

  test("the person's setting hides emails and long numbers and drops the recording", async () => {
    const t = newTest();
    const { userId, client } = await signedInAs(t);
    await client.mutation(api.privacy.setRedaction, { on: true });
    const callId = await insertCall(t, userId, { status: "in_session" });
    await t.mutation(api.vapiWebhook.recordEndOfCallReport, { secret: SECRET, report: { callId, ...REPORT } });
    const row = await t.run((ctx) => ctx.db.get(callId));
    expect(row?.transcript).toBe(
      "AI: How can I reach you?\nUser: Email me at [email] or call [number]. We grew 40% in 2024.",
    );
    expect(row?.recordingUrl).toBeUndefined();
    expect(row?.status).toBe("processing");
  });

  test("a workspace in health-data mode always redacts", async () => {
    const t = newTest();
    const { userId, client } = await signedInAs(t);
    const orgId = await client.mutation(api.orgs.create, { name: "Clinic" });
    await client.mutation(api.orgs.setPhiMode, { orgId, on: true });
    expect((await client.query(api.orgs.get, { orgId })).redactTranscripts).toBe(true);
    const callId = await insertCall(t, userId, { status: "in_session" });
    await t.run((ctx) => ctx.db.patch(callId, { orgId }));
    await t.mutation(api.vapiWebhook.recordEndOfCallReport, { secret: SECRET, report: { callId, ...REPORT } });
    expect((await t.run((ctx) => ctx.db.get(callId)))?.transcript).not.toContain("ada@example.com");
  });
});

describe("deleting a session", () => {
  test("removes its content, its weave and leaves a dated record", async () => {
    const t = newTest();
    const { userId, client } = await signedInAs(t);
    const callId = await finishedSession(t, userId);
    await client.mutation(api.privacy.deleteSession, { callId });
    expect(await contentLeft(t, callId)).toEqual(NOTHING_LEFT);
    const [listed] = await client.query(api.calls.listMine, {});
    expect(listed).toMatchObject({ _id: callId, contentDeleted: true, status: "completed" });
    const activity = await client.query(api.privacy.myActivity, {});
    expect(activity.map((a) => a.action)).toContain("session.delete");
  });

  test("only the owner can, and not while it's still running", async () => {
    const t = newTest();
    const { userId, client } = await signedInAs(t, "Ada");
    const { client: other } = await signedInAs(t, "Bo");
    const callId = await finishedSession(t, userId);
    await expect(other.mutation(api.privacy.deleteSession, { callId })).rejects.toThrow("NOT_FOUND");
    expect((await contentLeft(t, callId)).outputs).toBe(1);

    const live = await insertCall(t, userId, { status: "in_session" });
    await expect(client.mutation(api.privacy.deleteSession, { callId: live })).rejects.toThrow("SESSION_ACTIVE");
  });

  test("a weave other sessions still use stays, with one fewer session", async () => {
    const t = newTest();
    const { userId, client } = await signedInAs(t);
    const first = await finishedSession(t, userId);
    const second = await insertCall(t, userId, { status: "completed" });
    await t.run(async (ctx) => {
      const weave = (await ctx.db.query("weaves").first())!;
      await ctx.db.patch(weave._id, { sessionCount: 2 });
      await ctx.db.insert("weaveLinks", { weaveId: weave._id, callId: second, userId, note: "again" });
    });
    await client.mutation(api.privacy.deleteSession, { callId: first });
    const weaves = await t.run((ctx) => ctx.db.query("weaves").collect());
    expect(weaves.map((w) => w.sessionCount)).toEqual([1]);
  });
});

describe("retention", () => {
  test("only the listed limits are accepted, and only owners set a workspace's", async () => {
    const t = newTest();
    const { client } = await signedInAs(t, "Olive");
    await expect(client.mutation(api.privacy.setRetention, { days: 7 })).rejects.toThrow("INVALID_RETENTION");
    await client.mutation(api.privacy.setRetention, { days: 90 });
    expect(await client.query(api.privacy.mySettings, {})).toEqual({ retentionDays: 90, redactTranscripts: false });
    await client.mutation(api.privacy.setRetention, { days: null });
    expect((await client.query(api.privacy.mySettings, {})).retentionDays).toBeNull();

    const orgId = await client.mutation(api.orgs.create, { name: "Acme" });
    const code = (await t.run((ctx) => ctx.db.get(orgId)))!.inviteCode;
    const { client: member } = await signedInAs(t, "Mo");
    await member.mutation(api.orgs.join, { code });
    await expect(member.mutation(api.orgs.setRetention, { orgId, days: 30 })).rejects.toThrow("FORBIDDEN");
    await expect(member.mutation(api.orgs.setRedaction, { orgId, on: true })).rejects.toThrow("FORBIDDEN");
    await client.mutation(api.orgs.setRetention, { orgId, days: 30 });
    expect((await client.query(api.orgs.get, { orgId })).retentionDays).toBe(30);
  });

  test("the daily job deletes content past the person's limit and nothing newer", async () => {
    const t = newTest();
    const { userId, client } = await signedInAs(t);
    // Creation times only move forward, so the clock moves ahead from now.
    const start = Date.now();
    const old = await finishedSession(t, userId);
    vi.setSystemTime(start + 24 * DAY_MS);
    const recent = await insertCall(t, userId, { status: "completed", transcript: "User: recent" });
    vi.setSystemTime(start + 35 * DAY_MS);

    // No limit set: nothing happens.
    await t.mutation(internal.privacy.purgeExpired, {});
    expect((await contentLeft(t, old)).purged).toBe(false);

    await client.mutation(api.privacy.setRetention, { days: 30 });
    await t.mutation(internal.privacy.purgeExpired, {});
    expect(await contentLeft(t, old)).toEqual(NOTHING_LEFT);
    expect((await contentLeft(t, recent)).transcript).toBe("User: recent");

    const activity = await client.query(api.privacy.myActivity, {});
    expect(activity[0]).toMatchObject({ action: "retention.purge", bySystem: true, details: { sessions: 1 } });

    // Running again finds nothing more to do and logs nothing.
    await t.mutation(internal.privacy.purgeExpired, {});
    expect((await client.query(api.privacy.myActivity, {})).filter((a) => a.action === "retention.purge")).toHaveLength(1);
  });

  test("a workspace's limit applies to its sessions only", async () => {
    const t = newTest();
    const { userId, client } = await signedInAs(t);
    const orgId = await client.mutation(api.orgs.create, { name: "Acme" });
    const inOrg = await finishedSession(t, userId, { orgId });
    const personal = await insertCall(t, userId, { status: "completed", transcript: "User: personal" });
    await client.mutation(api.orgs.setRetention, { orgId, days: 30 });
    vi.setSystemTime(Date.now() + 31 * DAY_MS);
    await t.mutation(internal.privacy.purgeExpired, {});
    expect((await contentLeft(t, inOrg)).purged).toBe(true);
    expect((await contentLeft(t, personal)).transcript).toBe("User: personal");
    const log = await client.query(api.orgs.activity, { orgId });
    expect(log[0]).toMatchObject({ action: "retention.purge", actor: null });
  });
});

describe("export", () => {
  test("downloads everything about you, nobody else, and is logged", async () => {
    const t = newTest();
    const { userId, client } = await signedInAs(t, "Ada");
    const { userId: otherId } = await signedInAs(t, "Bo");
    await finishedSession(t, userId);
    await finishedSession(t, otherId);
    await client.mutation(api.orgs.create, { name: "Acme" });

    const data = await client.mutation(api.privacy.exportMine, {});
    expect(data.profile).toMatchObject({ name: "Ada", email: "ada@example.com" });
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0]).toMatchObject({ transcript: "User: something private" });
    expect(data.sessions[0].outputs.map((o) => o.body)).toEqual(["Private summary"]);
    expect(data.memories.map((m) => m.content)).toEqual(["Private fact"]);
    expect(data.weaves.map((w) => w.summary)).toEqual(["Private weave"]);
    expect(data.workspaces).toMatchObject([{ name: "Acme", role: "owner" }]);
    expect(JSON.stringify(data)).not.toContain("bo@example.com");

    const activity = await client.query(api.privacy.myActivity, {});
    expect(activity[0]).toMatchObject({ action: "data.export", byMe: true, details: { sessions: 1 } });
  });
});

describe("audit log", () => {
  test("workspace admins see who did what; members can't", async () => {
    const t = newTest();
    const { client: owner } = await signedInAs(t, "Olive");
    const { userId: memberId, client: member } = await signedInAs(t, "Mo");
    const orgId = await owner.mutation(api.orgs.create, { name: "Acme" });
    await member.mutation(api.orgs.join, { code: (await t.run((ctx) => ctx.db.get(orgId)))!.inviteCode });
    await owner.mutation(api.orgs.setRole, { orgId, userId: memberId, role: "admin" });
    await owner.mutation(api.orgs.setPhiMode, { orgId, on: true });

    const log = await member.query(api.orgs.activity, { orgId });
    expect(log.map((e) => e.action)).toEqual(["org.phi_mode", "org.role_change", "org.join", "org.create"]);
    expect(log[1]).toMatchObject({ actor: "Olive", subject: "Mo", details: { from: "member", to: "admin" } });

    await owner.mutation(api.orgs.setRole, { orgId, userId: memberId, role: "member" });
    await expect(member.query(api.orgs.activity, { orgId })).rejects.toThrow("FORBIDDEN");
    // The member still sees what happened to them.
    const mine = await member.query(api.privacy.myActivity, {});
    expect(mine.map((e) => e.action)).toEqual(["org.role_change", "org.role_change", "org.join"]);
  });

  test("nothing in the log holds session content", async () => {
    const t = newTest();
    const { userId, client } = await signedInAs(t);
    const callId = await finishedSession(t, userId);
    await client.mutation(api.privacy.exportMine, {});
    await client.mutation(api.privacy.deleteSession, { callId });
    const rows = JSON.stringify(await t.run((ctx) => ctx.db.query("auditLog").collect()));
    expect(rows).not.toMatch(/Private|something private/);
  });
});
