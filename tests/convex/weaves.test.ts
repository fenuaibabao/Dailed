import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { insertCall, newTest, signedInAs, type TestConvex } from "./helpers";

function openAIReply(content: unknown) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  process.env.OPENAI_API_KEY = "sk-test";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env.OPENAI_API_KEY;
});

/** A finished session with a summary and themes, ready to weave. */
async function completedCall(
  t: TestConvex,
  userId: Id<"users">,
  opts: { summary?: string; themes?: string[]; sensitive?: boolean; product?: string } = {},
) {
  const callId = await insertCall(t, userId, { status: "completed", sensitive: opts.sensitive ?? false });
  await t.run(async (ctx) => {
    if (opts.product) {
      const app = await ctx.db
        .query("apps")
        .withIndex("by_slug", (q) => q.eq("slug", opts.product!))
        .unique();
      await ctx.db.patch(callId, { appId: app!._id, personaId: app!.defaultPersonaId! });
    }
    const base = { callId, userId, status: "draft" as const };
    await ctx.db.insert("outputs", {
      ...base,
      kind: "session_summary",
      body: opts.summary ?? "You talked about launching your podcast.",
    });
    for (const theme of opts.themes ?? ["Launching the podcast"]) {
      await ctx.db.insert("outputs", { ...base, kind: "theme", body: theme });
    }
  });
  return callId;
}

function sentPrompt(index: number): string {
  const init = (fetchMock.mock.calls[index] as [string, RequestInit])[1];
  return JSON.parse(String(init.body)).messages[1].content;
}

const PODCAST = {
  ref: null,
  title: "Launching the podcast",
  summary: "You're getting a podcast off the ground.",
  note: "You picked a name for the show.",
};

describe("weaves", () => {
  test("a first session starts a weave the owner can see", async () => {
    fetchMock.mockResolvedValueOnce(openAIReply({ weaves: [PODCAST] }));
    const t = newTest();
    const { userId, client } = await signedInAs(t);
    const callId = await completedCall(t, userId);

    await t.action(internal.weaves.weaveCall, { callId });

    expect(sentPrompt(0)).toContain("None yet");
    const weaves = await client.query(api.weaves.listMine, { product: "create" });
    expect(weaves).toHaveLength(1);
    expect(weaves[0]).toMatchObject({ title: "Launching the podcast", sessionCount: 1 });
    expect(weaves[0].sessions).toMatchObject([{ callId, note: "You picked a name for the show." }]);
    expect(await client.query(api.weaves.forCall, { callId })).toMatchObject([{ title: "Launching the podcast" }]);
    expect((await t.run((ctx) => ctx.db.get(callId)))?.wovenAt).toBeTypeOf("number");
  });

  test("a later session on the same topic joins the existing weave and keeps its name", async () => {
    const t = newTest();
    const { userId, client } = await signedInAs(t);
    fetchMock.mockResolvedValueOnce(openAIReply({ weaves: [PODCAST] }));
    await t.action(internal.weaves.weaveCall, { callId: await completedCall(t, userId) });

    fetchMock.mockResolvedValueOnce(
      openAIReply({
        weaves: [
          { ref: "w1", title: "Podcast launch", summary: "You named the show and booked a first guest.", note: "You booked a guest." },
          { ref: null, title: "Moving house", summary: "You're moving in spring.", note: "You found a place." },
        ],
      }),
    );
    const second = await completedCall(t, userId, { summary: "You booked a guest and found a flat." });
    await t.action(internal.weaves.weaveCall, { callId: second });

    expect(sentPrompt(1)).toContain("w1: Launching the podcast.");
    const weaves = await client.query(api.weaves.listMine, { product: "create" });
    expect(weaves.map((w) => w.title).sort()).toEqual(["Launching the podcast", "Moving house"]);
    const podcast = weaves.find((w) => w.title === "Launching the podcast")!;
    expect(podcast).toMatchObject({ sessionCount: 2, summary: "You named the show and booked a first guest." });
    expect(podcast.sessions.map((s) => s.callId)).toContain(second);
  });

  test("a ref we never sent starts a new weave, and the same weave named twice is joined once", async () => {
    const t = newTest();
    const { userId } = await signedInAs(t);
    fetchMock.mockResolvedValueOnce(openAIReply({ weaves: [PODCAST] }));
    await t.action(internal.weaves.weaveCall, { callId: await completedCall(t, userId) });
    fetchMock.mockResolvedValueOnce(
      openAIReply({
        weaves: [
          { ref: "w1", title: "x", summary: "Updated.", note: "Again." },
          { ref: "w1", title: "x", summary: "Updated twice.", note: "Again twice." },
          { ref: "w9", title: "Hiring", summary: "You want to hire.", note: "First thoughts." },
        ],
      }),
    );
    const callId = await completedCall(t, userId);
    await t.action(internal.weaves.weaveCall, { callId });
    const links = await t.run((ctx) =>
      ctx.db
        .query("weaveLinks")
        .withIndex("by_call", (q) => q.eq("callId", callId))
        .collect(),
    );
    expect(links).toHaveLength(2);
    const weaves = await t.run((ctx) => ctx.db.query("weaves").collect());
    expect(weaves.map((w) => w.title).sort()).toEqual(["Hiring", "Launching the podcast"]);
  });

  test("weaving a session twice never duplicates", async () => {
    fetchMock.mockResolvedValue(openAIReply({ weaves: [PODCAST] }));
    const t = newTest();
    const { userId } = await signedInAs(t);
    const callId = await completedCall(t, userId);
    await t.action(internal.weaves.weaveCall, { callId });
    await t.action(internal.weaves.weaveCall, { callId });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await t.run((ctx) => ctx.db.query("weaveLinks").collect())).toHaveLength(1);
  });

  test("sensitive sessions only see and join sensitive weaves", async () => {
    const t = newTest();
    const { userId } = await signedInAs(t);
    fetchMock.mockResolvedValueOnce(openAIReply({ weaves: [PODCAST] }));
    await t.action(internal.weaves.weaveCall, { callId: await completedCall(t, userId) });

    fetchMock.mockResolvedValueOnce(
      openAIReply({ weaves: [{ ref: "w1", title: "A hard month", summary: "Private.", note: "Private." }] }),
    );
    const sensitiveCall = await completedCall(t, userId, { sensitive: true, themes: ["A hard month"] });
    await t.action(internal.weaves.weaveCall, { callId: sensitiveCall });

    expect(sentPrompt(1)).toContain("None yet");
    expect(sentPrompt(1)).not.toContain("Launching the podcast");
    const weaves = await t.run((ctx) => ctx.db.query("weaves").collect());
    expect(weaves).toHaveLength(2);
    expect(weaves.find((w) => w.title === "A hard month")?.sensitive).toBe(true);
    expect(weaves.find((w) => w.title === "Launching the podcast")?.sessionCount).toBe(1);
  });

  test("weaves stay inside their product", async () => {
    const t = newTest();
    const { userId, client } = await signedInAs(t);
    fetchMock.mockResolvedValueOnce(openAIReply({ weaves: [PODCAST] }));
    await t.action(internal.weaves.weaveCall, { callId: await completedCall(t, userId) });
    fetchMock.mockResolvedValueOnce(
      openAIReply({ weaves: [{ ref: null, title: "Whether to move", summary: "You're weighing a move.", note: "Pros and cons." }] }),
    );
    await t.action(internal.weaves.weaveCall, { callId: await completedCall(t, userId, { product: "clarity" }) });

    expect(sentPrompt(1)).toContain("None yet");
    expect((await client.query(api.weaves.listMine, { product: "create" })).map((w) => w.title)).toEqual([
      "Launching the podcast",
    ]);
    expect((await client.query(api.weaves.listMine, { product: "clarity" })).map((w) => w.title)).toEqual([
      "Whether to move",
    ]);
    expect(await client.query(api.weaves.listMine, { product: "nope" })).toEqual([]);
  });

  test("a model failure leaves the session's results alone and the session unwoven", async () => {
    fetchMock.mockResolvedValue(new Response("upstream down", { status: 503 }));
    const t = newTest();
    const { userId } = await signedInAs(t);
    const callId = await completedCall(t, userId);
    await t.action(internal.weaves.weaveCall, { callId });
    const row = await t.run((ctx) => ctx.db.get(callId));
    expect(row?.status).toBe("completed");
    expect(row?.wovenAt).toBeUndefined();
    expect(await t.run((ctx) => ctx.db.query("weaves").collect())).toEqual([]);
  });

  test("people only see their own weaves", async () => {
    fetchMock.mockResolvedValueOnce(openAIReply({ weaves: [PODCAST] }));
    const t = newTest();
    const { userId } = await signedInAs(t, "Ada");
    const { client: other } = await signedInAs(t, "Bo");
    const callId = await completedCall(t, userId);
    await t.action(internal.weaves.weaveCall, { callId });

    expect(await other.query(api.weaves.listMine, { product: "create" })).toEqual([]);
    await expect(other.query(api.weaves.forCall, { callId })).rejects.toThrow("NOT_FOUND");
  });

  test("finishing a session's processing schedules weaving", async () => {
    const t = newTest();
    const { userId, client } = await signedInAs(t);
    const callId = await insertCall(t, userId, {
      status: "processing",
      transcript: "AI: Hi.\nUser: I'm launching a podcast next month and I just picked the name for it.",
    });
    fetchMock
      .mockResolvedValueOnce(
        openAIReply({ session_summary: "You talked about launching your podcast.", themes: ["Launching"] }),
      )
      .mockResolvedValueOnce(openAIReply({ weaves: [PODCAST] }));

    await t.action(internal.processor.run, { callId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await client.query(api.weaves.forCall, { callId })).toMatchObject([{ title: "Launching the podcast" }]);
  });
});
