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
  process.env.OPENAI_API_KEY = "sk-test";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
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
    expect(kinds).toEqual(["idea", "post", "script", "session_summary", "theme", "theme"]);
    // The post with an invented excerpt ("$2M") was dropped.
    expect(outputs.filter((o) => o.kind === "post").map((o) => o.title)).toEqual(["The kiln question"]);
    expect(outputs.find((o) => o.kind === "script")?.body).toContain("Hook: The scariest part");

    const memories = await t.run((ctx) => ctx.db.query("memories").collect());
    expect(memories.map((m) => m.content).sort()).toEqual(["Building a pottery studio", "Left their job in March"]);
    expect(memories.every((m) => m.userId === userId && m.callId === callId && !m.sensitive)).toBe(true);
    expect((await t.run((ctx) => ctx.db.get(callId)))?.status).toBe("completed");
  });

  test("when every draft fails grounding, asks once more and keeps the grounded retry", async () => {
    const invented = {
      ...GOOD,
      posts: [{ ...GOOD.posts[0], source_excerpt: "My father wanted to know about the kiln plan" }],
      scripts: [{ ...GOOD.scripts[0], source_excerpt: "Telling my mom and dad was the hardest bit" }],
    };
    fetchMock
      .mockResolvedValueOnce(openAIReply(JSON.stringify(invented)))
      .mockResolvedValueOnce(openAIReply(JSON.stringify(GOOD)));
    const t = newTest();
    const { userId, client } = await signedInAs(t);
    const callId = await processingCall(t, userId);
    await t.action(internal.processor.run, { callId });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryBody = JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body));
    expect(retryBody.messages[1].content).toContain("My father wanted to know about the kiln plan");
    const outputs = await client.query(api.outputs.forCall, { callId });
    expect(outputs.filter((o) => o.kind === "post")).toHaveLength(1);
    expect(outputs.filter((o) => o.kind === "script")).toHaveLength(1);
    const row = await t.run((ctx) => ctx.db.get(callId));
    expect(row?.status).toBe("completed");
    expect(row?.draftsDropped).toBe(1); // the invented "$2M" post in the retry
  });

  test("keeps the first pass when the grounding retry fails", async () => {
    const invented = { ...GOOD, posts: [{ ...GOOD.posts[1] }], scripts: [] };
    fetchMock
      .mockResolvedValueOnce(openAIReply(JSON.stringify(invented)))
      .mockResolvedValue(new Response("upstream down", { status: 503 }));
    const t = newTest();
    const { userId } = await signedInAs(t);
    const callId = await processingCall(t, userId);
    await t.action(internal.processor.run, { callId });
    const row = await t.run((ctx) => ctx.db.get(callId));
    expect(row?.status).toBe("completed");
    expect(row?.draftsDropped).toBe(1);
    const kinds = (await t.run((ctx) => ctx.db.query("outputs").collect())).map((o) => o.kind);
    expect(kinds).toContain("session_summary");
    expect(kinds).not.toContain("post");
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
          scripts: [],
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
