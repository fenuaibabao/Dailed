import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { REMI_SYSTEM_PROMPT, remiSystemPrompt } from "../../convex/lib/remi";
import { PRODUCTS } from "../../src/config/products";
import {
  TEST_ASSISTANT_ID,
  grantConsent,
  insertCall,
  newTest,
  seedApp,
  signedInAs,
  type TestConvex,
} from "./helpers";

async function readyUser(t: TestConvex, name = "Ada") {
  await seedApp(t);
  const user = await signedInAs(t, name);
  await grantConsent(t, user.userId);
  return user;
}

describe("start", () => {
  test("refuses without recording consent", async () => {
    const t = newTest();
    await seedApp(t);
    const { client } = await signedInAs(t);
    await expect(client.mutation(api.calls.start, {})).rejects.toThrow(
      "RECORDING_CONSENT_REQUIRED",
    );
  });

  test("creates a queued call owned by the caller and returns the Vapi config", async () => {
    const t = newTest();
    const { userId, client } = await readyUser(t);
    const result = await client.mutation(api.calls.start, { focus: "  my launch  " });

    expect(result.assistantId).toBe(TEST_ASSISTANT_ID);
    expect(result.assistantOverrides.metadata).toEqual({ call_id: result.callId });
    expect(result.assistantOverrides.maxDurationSeconds).toBe(5400);
    expect(result.assistantOverrides.model).toMatchObject({ provider: "openai", model: "gpt-4.1-mini" });

    const prompt = result.assistantOverrides.model.messages[0].content;
    expect(prompt.startsWith(REMI_SYSTEM_PROMPT)).toBe(true);
    expect(prompt).toContain("ask how much time they have today");
    expect(prompt).toContain("Today's focus: my launch");

    const row = await t.run((ctx) => ctx.db.get(result.callId));
    expect(row).toMatchObject({ userId, status: "queued", mode: "open", channel: "web", focus: "my launch" });
  });

  test("the product sets the app, Remi's focus and first message", async () => {
    const t = newTest();
    const { client } = await readyUser(t);
    const result = await client.mutation(api.calls.start, { product: "clarity" });
    expect(result.assistantOverrides.model.messages[0].content.startsWith(remiSystemPrompt(PRODUCTS.clarity))).toBe(
      true,
    );
    expect(result.assistantOverrides.firstMessage).toContain("to make your private summary");
    const call = await t.run((ctx) => ctx.db.get(result.callId));
    const app = await t.run((ctx) => ctx.db.get(call!.appId));
    expect(app?.slug).toBe("clarity");
  });

  test("refuses products that aren't enabled or don't exist", async () => {
    const t = newTest();
    const { client } = await readyUser(t);
    await expect(client.mutation(api.calls.start, { product: "founder" })).rejects.toThrow("PRODUCT_UNAVAILABLE");
    await expect(client.mutation(api.calls.start, { product: "nope" })).rejects.toThrow("PRODUCT_UNAVAILABLE");
    expect(await t.run((ctx) => ctx.db.query("calls").collect())).toEqual([]);
  });

  test("ignores any user id smuggled into the arguments", async () => {
    const t = newTest();
    const { client } = await readyUser(t);
    const other = await signedInAs(t, "Grace");
    await expect(
      // @ts-expect-error userId is not an accepted argument
      client.mutation(api.calls.start, { userId: other.userId }),
    ).rejects.toThrow();
  });
});

describe("memory in the prompt", () => {
  async function addMemory(
    t: TestConvex,
    userId: Id<"users">,
    appId: Id<"apps">,
    content: string,
    importance: number,
    sensitive = false,
  ) {
    await t.run((ctx) =>
      ctx.db.insert("memories", { userId, appId, kind: "fact", content, importance, sensitive }),
    );
  }

  test("includes the top 15 non-sensitive memories by importance, and nobody else's", async () => {
    const t = newTest();
    const { appId } = await seedApp(t);
    const { userId, client } = await readyUser(t);
    const grace = await signedInAs(t, "Grace");

    for (let i = 0; i < 10; i++) await addMemory(t, userId, appId, `low-${i}`, 1);
    for (let i = 0; i < 12; i++) await addMemory(t, userId, appId, `high-${i}`, 5);
    await addMemory(t, userId, appId, "mid-0", 3);
    await addMemory(t, userId, appId, "secret-0", 5, true);
    await addMemory(t, grace.userId, appId, "grace-0", 5);

    const result = await client.mutation(api.calls.start, {});
    const prompt = result.assistantOverrides.model.messages[0].content;
    const included = [...prompt.matchAll(/- Fact: (\S+)/g)].map((m) => m[1]);

    expect(included).toHaveLength(15);
    expect(included.slice(0, 12).every((c) => c.startsWith("high-"))).toBe(true);
    expect(included[12]).toBe("mid-0");
    expect(included.filter((c) => c.startsWith("low-"))).toHaveLength(2);
    expect(prompt).not.toContain("secret-0");
    expect(prompt).not.toContain("grace-0");
  });

  test("includes the last 3 non-sensitive session summaries", async () => {
    const t = newTest();
    const { userId, client } = await readyUser(t);
    for (const [i, sensitive] of [false, false, false, false, true].entries()) {
      const callId = await insertCall(t, userId, { status: "completed", sensitive });
      await t.run((ctx) =>
        ctx.db.insert("outputs", {
          callId,
          userId,
          kind: "session_summary",
          body: `summary-${i}`,
          status: "draft",
        }),
      );
    }
    const result = await client.mutation(api.calls.start, {});
    const prompt = result.assistantOverrides.model.messages[0].content;
    expect(prompt).toContain("summary-3");
    expect(prompt).toContain("summary-2");
    expect(prompt).toContain("summary-1");
    expect(prompt).not.toContain("summary-0");
    expect(prompt).not.toContain("summary-4");
  });

  test("a first session says so instead of an empty memory block", async () => {
    const t = newTest();
    const { client } = await readyUser(t);
    const result = await client.mutation(api.calls.start, {});
    expect(result.assistantOverrides.model.messages[0].content).toContain(
      "This is your first session with this person.",
    );
  });
});

describe("ownership", () => {
  test("other users can't read, update or see outputs of a call", async () => {
    const t = newTest();
    const ada = await signedInAs(t, "Ada");
    const grace = await signedInAs(t, "Grace");
    const callId = await insertCall(t, ada.userId);

    await expect(grace.client.query(api.calls.get, { callId })).rejects.toThrow("NOT_FOUND");
    await expect(grace.client.query(api.outputs.forCall, { callId })).rejects.toThrow("NOT_FOUND");
    await expect(
      grace.client.mutation(api.calls.reportClientStatus, { callId, status: "in_session" }),
    ).rejects.toThrow("NOT_FOUND");
    expect(await grace.client.query(api.calls.listMine, {})).toEqual([]);
    expect(await ada.client.query(api.calls.listMine, {})).toHaveLength(1);
  });

  test("call lists never include transcripts", async () => {
    const t = newTest();
    const ada = await signedInAs(t);
    await insertCall(t, ada.userId, { status: "completed", transcript: "User: private words" });
    const [row] = await ada.client.query(api.calls.listMine, {});
    expect(JSON.stringify(row)).not.toContain("private words");
  });
});

describe("client status reports", () => {
  test("move forward only, and record the Vapi call id once", async () => {
    const t = newTest();
    const { userId, client } = await signedInAs(t);
    const callId = await insertCall(t, userId);

    await client.mutation(api.calls.reportClientStatus, { callId, status: "connecting", vapiCallId: "vapi-1" });
    await client.mutation(api.calls.reportClientStatus, { callId, status: "in_session" });
    // A late "connecting" doesn't move it backwards.
    const after = await client.mutation(api.calls.reportClientStatus, {
      callId,
      status: "connecting",
      vapiCallId: "vapi-1",
    });
    expect(after.status).toBe("in_session");
    expect(after.startedAt).not.toBeNull();

    await expect(
      client.mutation(api.calls.reportClientStatus, { callId, status: "connecting", vapiCallId: "vapi-2" }),
    ).rejects.toThrow("VAPI_CALL_ID_MISMATCH");

    const row = await t.run((ctx) => ctx.db.get(callId));
    expect(row?.vapiCallId).toBe("vapi-1");
  });

  test("a Vapi call id already used by another call is rejected", async () => {
    const t = newTest();
    const ada = await signedInAs(t, "Ada");
    const grace = await signedInAs(t, "Grace");
    await insertCall(t, ada.userId, { vapiCallId: "vapi-taken" });
    const graceCall = await insertCall(t, grace.userId);
    await expect(
      grace.client.mutation(api.calls.reportClientStatus, {
        callId: graceCall,
        status: "connecting",
        vapiCallId: "vapi-taken",
      }),
    ).rejects.toThrow("VAPI_CALL_ID_MISMATCH");
  });

  test("the browser can't mark a call completed after processing started", async () => {
    const t = newTest();
    const { userId, client } = await signedInAs(t);
    const callId = await insertCall(t, userId, { status: "processing" });
    const result = await client.mutation(api.calls.reportClientStatus, { callId, status: "failed" });
    expect(result.status).toBe("processing");
  });
});
