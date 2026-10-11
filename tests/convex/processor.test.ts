import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { insertCall, newTest, signedInAs, type TestConvex } from "./helpers";

const TRANSCRIPT = [
  "AI: Hi, this is Remi. Got a few minutes?",
  "User: Yeah. I left my job in March to build a pottery studio, and honestly the scariest part was telling my parents.",
  "AI: What happened when you told them?",
  "User: My dad just asked whether I had a plan for the kiln, which is the most engineer thing he could have said.",
].join("\n");

const GOOD = {
  session_summary: "You talked about leaving your job to build a pottery studio.",
  themes: ["Leaving a stable job", "Family reactions"],
  posts: [
    {
      platform: "linkedin",
      title: "The kiln question",
      body: "When I told my dad I was quitting, he asked about the kiln.",
      source_excerpt: "My dad just asked whether I had a plan for the kiln",
    },
    {
      platform: "x",
      body: "I made $2M in my first month!",
      source_excerpt: "I made two million dollars in my first month of sales",
    },
  ],
  scripts: [
    {
      title: "Telling my parents",
      hook: "The scariest part of quitting wasn't money.",
      beats: ["I left my job in March.", "I had to tell my parents.", "Dad asked about the kiln."],
      close: "Sometimes support sounds like a practical question.",
      source_excerpt: "the scariest part was telling my parents",
    },
  ],
  newsletter: null,
  ideas: ["What the first month in the studio was like"],
  memories: [
    { kind: "goal", content: "Building a pottery studio", importance: 5 },
    { kind: "fact", content: "Left their job in March", importance: 4 },
  ],
};

function openAIReply(content: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // Saving results schedules weaving; fake timers keep it from running in the
  // background of these tests (weaves.test.ts covers it).
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

async function processingCall(t: TestConvex, userId: Id<"users">, extra: { durationSeconds?: number; transcript?: string; sensitive?: boolean } = {}) {
  return insertCall(t, userId, { status: "processing", transcript: TRANSCRIPT, ...extra });
}

describe("processor", () => {
  test("writes summary, themes, grounded drafts and memories, then completes", async () => {
    fetchMock.mockResolvedValueOnce(openAIReply(JSON.stringify(GOOD)));
    const t = newTest();
    const { userId, client } = await signedInAs(t);
    const callId = await processingCall(t, userId);

    await t.action(internal.processor.run, { callId });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(JSON.parse(String(init.body))).toMatchObject({ model: "gpt-4.1-mini", response_format: { type: "json_object" } });

    const outputs = await client.query(api.outputs.forCall, { callId });
    const kinds = outputs.map((o) => o.kind).sort();
    expect(kinds).toEqual(["idea", "post", "post", "script", "session_summary", "theme", "theme"]);
    // The post quoting something never said keeps its draft but loses the quote.
    const posts = outputs.filter((o) => o.kind === "post");
    expect(posts.find((o) => o.title === "The kiln question")?.sourceExcerpt).toBe(
      "My dad just asked whether I had a plan for the kiln",
    );
    expect(posts.find((o) => o.title === undefined)?.sourceExcerpt).toBeUndefined();
    expect(outputs.find((o) => o.kind === "script")?.body).toContain("Hook: The scariest part");

    const memories = await t.run((ctx) => ctx.db.query("memories").collect());
    expect(memories.map((m) => m.content).sort()).toEqual(["Building a pottery studio", "Left their job in March"]);
    expect(memories.every((m) => m.userId === userId && m.callId === callId && !m.sensitive)).toBe(true);
    const row = await t.run((ctx) => ctx.db.get(callId));
    expect(row?.status).toBe("completed");
    expect(row?.grounding).toEqual({ drafts: 3, quotesKept: 2, quotesFixed: 0, quotesDropped: 1 });
    expect(row?.noDraftsReason).toBeUndefined();
  });

  test("a session of a few minutes with no script asks once more and keeps the fuller reply", async () => {
    fetchMock
      .mockResolvedValueOnce(openAIReply(JSON.stringify({ ...GOOD, scripts: [] })))
      .mockResolvedValueOnce(openAIReply(JSON.stringify(GOOD)));
    const t = newTest();
    const { userId } = await signedInAs(t);
    const callId = await processingCall(t, userId, { durationSeconds: 226 });
    await t.action(internal.processor.run, { callId });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryBody = JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body));
    expect(retryBody.messages[1].content).toContain("at least one post and one script");
    const kinds = (await t.run((ctx) => ctx.db.query("outputs").collect())).map((o) => o.kind);
    expect(kinds.filter((k) => k === "script")).toHaveLength(1);
    expect((await t.run((ctx) => ctx.db.get(callId)))?.noDraftsReason).toBeUndefined();
  });

  test("records why when a long enough session truly has nothing usable", async () => {
    const empty = { ...GOOD, posts: [], scripts: [], no_drafts_reason: "You only said hello and goodbye." };
    fetchMock.mockResolvedValue(openAIReply(JSON.stringify(empty)));
    const t = newTest();
    const { userId } = await signedInAs(t);
    const callId = await processingCall(t, userId, { durationSeconds: 300 });
    await t.action(internal.processor.run, { callId });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const row = await t.run((ctx) => ctx.db.get(callId));
    expect(row?.status).toBe("completed");
    expect(row?.noDraftsReason).toBe("You only said hello and goodbye.");
  });

  test("a short session isn't pushed for drafts, and a failed retry keeps the first pass", async () => {
    const t = newTest();
    const { userId } = await signedInAs(t);
    fetchMock.mockResolvedValueOnce(openAIReply(JSON.stringify({ ...GOOD, posts: [], scripts: [] })));
    const shortCall = await processingCall(t, userId, { durationSeconds: 45 });
    await t.action(internal.processor.run, { callId: shortCall });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock
      .mockResolvedValueOnce(openAIReply(JSON.stringify({ ...GOOD, scripts: [] })))
      .mockResolvedValue(new Response("upstream down", { status: 503 }));
    const longCall = await processingCall(t, userId, { durationSeconds: 600 });
    await t.action(internal.processor.run, { callId: longCall });
    const row = await t.run((ctx) => ctx.db.get(longCall));
    expect(row?.status).toBe("completed");
    expect(row?.noDraftsReason).toMatch(/didn't find anything usable/);
  });

  test("a product without posts or scripts (Clarity) saves none and doesn't ask for them", async () => {
    fetchMock.mockResolvedValue(openAIReply(JSON.stringify(GOOD)));
    const t = newTest();
    const { userId } = await signedInAs(t);
    const callId = await processingCall(t, userId, { durationSeconds: 600 });
    await t.run(async (ctx) => {
      const clarity = await ctx.db
        .query("apps")
        .withIndex("by_slug", (q) => q.eq("slug", "clarity"))
        .unique();
      await ctx.db.patch(callId, { appId: clarity!._id, personaId: clarity!.defaultPersonaId! });
    });
    await t.action(internal.processor.run, { callId });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.messages[0].content).toContain("private reflection");
    const kinds = (await t.run((ctx) => ctx.db.query("outputs").collect())).map((o) => o.kind);
    expect(kinds).toContain("session_summary");
    expect(kinds.some((k) => ["post", "script", "newsletter"].includes(k))).toBe(false);
    const row = await t.run((ctx) => ctx.db.get(callId));
    expect(row?.status).toBe("completed");
    expect(row?.noDraftsReason).toBeUndefined();
  });

  test("retries once on invalid JSON, then succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(openAIReply("Sure! Here are your drafts: {"))
      .mockResolvedValueOnce(openAIReply(JSON.stringify(GOOD)));
    const t = newTest();
    const { userId } = await signedInAs(t);
    const callId = await processingCall(t, userId);
    await t.action(internal.processor.run, { callId });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryBody = JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body));
    expect(retryBody.messages[1].content).toContain("previous reply was not valid");
    expect((await t.run((ctx) => ctx.db.get(callId)))?.status).toBe("completed");
  });

  test("fails the call after two invalid replies, with a friendly message", async () => {
    fetchMock.mockResolvedValue(openAIReply(JSON.stringify({ themes: "not an array" })));
    const t = newTest();
    const { userId } = await signedInAs(t);
    const callId = await processingCall(t, userId);
    await t.action(internal.processor.run, { callId });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const row = await t.run((ctx) => ctx.db.get(callId));
    expect(row?.status).toBe("failed");
    expect(row?.processingError).toMatch(/couldn't create drafts/);
    expect(await t.run((ctx) => ctx.db.query("outputs").collect())).toEqual([]);
  });

  test("an API error fails the call without leaking the key", async () => {
    fetchMock.mockResolvedValue(new Response("upstream down", { status: 503 }));
    const t = newTest();
    const { userId } = await signedInAs(t);
    const callId = await processingCall(t, userId);
    await t.action(internal.processor.run, { callId });
    const row = await t.run((ctx) => ctx.db.get(callId));
    expect(row?.status).toBe("failed");
    expect(row?.processingError).not.toContain("sk-test");
  });

  test("long sessions are summarized in chunks first", async () => {
    const longTranscript = Array.from(
      { length: 400 },
      (_, i) => `User: This is line ${i} about the studio, the kiln, the glazes and the people who come by.`,
    ).join("\n");
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      const system: string = body.messages[0].content;
      if (system.includes("condensing one part")) {
        return openAIReply(JSON.stringify({ notes: "Talked about the studio.", quotes: ["This is line 1 about the studio, the kiln"] }));
      }
      return openAIReply(
        JSON.stringify({
          ...GOOD,
          posts: [{ ...GOOD.posts[0], source_excerpt: "This is line 1 about the studio, the kiln" }],
          scripts: [{ ...GOOD.scripts[0], source_excerpt: "This is line 2 about the studio, the kiln" }],
        }),
      );
    });
    const t = newTest();
    const { userId } = await signedInAs(t);
    const callId = await processingCall(t, userId, { transcript: longTranscript, durationSeconds: 45 * 60 });
    await t.action(internal.processor.run, { callId });
    // 400 lines of ~90 chars = ~36k chars → 3 chunks + 1 final call.
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const final = JSON.parse(String((fetchMock.mock.calls[3] as [string, RequestInit])[1].body));
    expect(final.messages[1].content).toContain("condensed part by part");
    expect(final.messages[1].content.length).toBeLessThan(longTranscript.length);
    expect((await t.run((ctx) => ctx.db.get(callId)))?.status).toBe("completed");
  });

  test("sensitive sessions produce no posts, scripts or newsletter, and sensitive memories", async () => {
    fetchMock.mockResolvedValueOnce(openAIReply(JSON.stringify({ ...GOOD, newsletter: { title: "x", body: "y" } })));
    const t = newTest();
    const { userId } = await signedInAs(t);
    const callId = await processingCall(t, userId, { sensitive: true });
    await t.action(internal.processor.run, { callId });
    const outputs = await t.run((ctx) => ctx.db.query("outputs").collect());
    expect(outputs.some((o) => ["post", "script", "newsletter"].includes(o.kind))).toBe(false);
    const memories = await t.run((ctx) => ctx.db.query("memories").collect());
    expect(memories.every((m) => m.sensitive)).toBe(true);
  });

  test("running twice never duplicates outputs", async () => {
    fetchMock.mockResolvedValue(openAIReply(JSON.stringify(GOOD)));
    const t = newTest();
    const { userId } = await signedInAs(t);
    const callId = await processingCall(t, userId);
    await t.action(internal.processor.run, { callId });
    const count = (await t.run((ctx) => ctx.db.query("outputs").collect())).length;
    await t.action(internal.processor.run, { callId });
    expect((await t.run((ctx) => ctx.db.query("outputs").collect())).length).toBe(count);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("Founder sessions", () => {
  const FOUNDER_TRANSCRIPT = [
    "AI: How did the week go?",
    "User: We closed 3 new customers and monthly revenue is now 14,500 dollars, up from 11,000 last month.",
    "AI: Any big decisions?",
    "User: We decided to stop the free plan because support was eating our time, and we have 9 months of runway.",
  ].join("\n");

  const FOUNDER_REPLY = {
    session_summary: "A strong week: new customers and a pricing decision.",
    themes: ["Revenue growth", "Pricing"],
    posts: [],
    scripts: [],
    newsletter: null,
    ideas: ["How the paid-only switch lands"],
    memories: [{ kind: "goal", content: "Grow revenue", importance: 4 }],
    investor_update: {
      title: "Week update",
      body: "Highlights: MRR is $14,500, up from $11,000. Runway is 9 months.",
    },
    decisions: [{ decision: "Stop the free plan", why: "Support was eating our time." }],
    pitch: null,
  };

  async function founderCall(t: TestConvex, userId: Id<"users">) {
    const callId = await processingCall(t, userId, { transcript: FOUNDER_TRANSCRIPT, durationSeconds: 600 });
    await t.run(async (ctx) => {
      const founder = await ctx.db
        .query("apps")
        .withIndex("by_slug", (q) => q.eq("slug", "founder"))
        .unique();
      await ctx.db.patch(callId, { appId: founder!._id, personaId: founder!.defaultPersonaId! });
    });
    return callId;
  }

  test("saves the investor update, decision log and reflection, and no posts", async () => {
    fetchMock.mockResolvedValueOnce(openAIReply(JSON.stringify(FOUNDER_REPLY)));
    const t = newTest();
    const { userId } = await signedInAs(t);
    const callId = await founderCall(t, userId);
    await t.action(internal.processor.run, { callId });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.messages[0].content).toContain("founder's weekly check-in");
    const outputs = await t.run((ctx) => ctx.db.query("outputs").collect());
    expect(outputs.find((o) => o.kind === "investor_update")).toMatchObject({
      title: "Week update",
      body: "Highlights: MRR is $14,500, up from $11,000. Runway is 9 months.",
    });
    expect(outputs.find((o) => o.kind === "decision")).toMatchObject({
      title: "Stop the free plan",
      body: "Support was eating our time.",
    });
    expect(outputs.some((o) => ["post", "script", "pitch"].includes(o.kind))).toBe(false);
    expect((await t.run((ctx) => ctx.db.get(callId)))?.status).toBe("completed");
  });

  test("a number they never said is asked about once, then flagged", async () => {
    const invented = {
      ...FOUNDER_REPLY,
      investor_update: { title: "Week", body: "MRR is $14,500 and we have 2,000 users." },
      pitch: "We grew 40% this month.",
    };
    fetchMock.mockResolvedValue(openAIReply(JSON.stringify(invented)));
    const t = newTest();
    const { userId } = await signedInAs(t);
    const callId = await founderCall(t, userId);
    await t.action(internal.processor.run, { callId });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retry = JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body));
    expect(retry.messages[1].content).toContain("numbers the founder never said: 2,000, 40");
    const outputs = await t.run((ctx) => ctx.db.query("outputs").collect());
    expect(outputs.find((o) => o.kind === "investor_update")?.body).toBe(
      "MRR is $14,500 and we have 2,000 [check this number] users.",
    );
    expect(outputs.find((o) => o.kind === "pitch")?.body).toBe("We grew 40% [check this number] this month.");
  });

  test("a retry that fixes the numbers is kept", async () => {
    fetchMock
      .mockResolvedValueOnce(
        openAIReply(JSON.stringify({ ...FOUNDER_REPLY, investor_update: { title: "W", body: "MRR hit $20,000." } })),
      )
      .mockResolvedValueOnce(openAIReply(JSON.stringify(FOUNDER_REPLY)));
    const t = newTest();
    const { userId } = await signedInAs(t);
    const callId = await founderCall(t, userId);
    await t.action(internal.processor.run, { callId });
    const update = await t.run(async (ctx) => (await ctx.db.query("outputs").collect()).find((o) => o.kind === "investor_update"));
    expect(update?.body).not.toContain("[check this number]");
  });
});
