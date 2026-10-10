import { describe, expect, test } from "vitest";
import {
  chunkTranscript,
  groundExcerpt,
  isGroundedExcerpt,
  isLongSession,
  userSpeech,
} from "../../convex/lib/processing";
import { buildSessionPrompt } from "../../convex/lib/sessionPrompt";

describe("transcript helpers", () => {
  test("chunks on line boundaries without losing text", () => {
    const transcript = Array.from({ length: 50 }, (_, i) => `User: line ${i} ${"x".repeat(40)}`).join("\n");
    const chunks = chunkTranscript(transcript, 500);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 500)).toBe(true);
    expect(chunks.join("\n")).toBe(transcript);
  });

  test("long means over 30 minutes or a very long transcript", () => {
    expect(isLongSession("short", 31 * 60)).toBe(true);
    expect(isLongSession("short", 20 * 60)).toBe(false);
    expect(isLongSession("x".repeat(40_000))).toBe(true);
  });

  test("userSpeech keeps only the user's turns, including continuation lines", () => {
    const transcript = "AI: What are you building?\nUser: A studio.\nIt has a kiln.\nAI: Nice.\nUser: Thanks.";
    expect(userSpeech(transcript)).toBe(" A studio.\nIt has a kiln.\n Thanks.");
    expect(userSpeech("no labels here")).toBe("no labels here");
  });

  test("grounding accepts real quotes despite case and punctuation, and rejects inventions", () => {
    const speech = userSpeech("AI: Tell me more.\nUser: Honestly, the scariest part was telling my parents!");
    expect(isGroundedExcerpt("the scariest part was telling my parents", speech)).toBe(true);
    expect(isGroundedExcerpt("The Scariest part — was telling my parents.", speech)).toBe(true);
    expect(isGroundedExcerpt("the scariest part was telling my investors", speech)).toBe(false);
    expect(isGroundedExcerpt("Tell me more about it", speech)).toBe(false); // the AI said it
    expect(isGroundedExcerpt("my parents", speech)).toBe(false); // too short to count
  });

  test("grounding ignores filler words and returns the user's own wording", () => {
    const speech = userSpeech("User: So, um, I left my job in March to, uh, build a pottery studio.");
    expect(groundExcerpt("I left my job in March to build a pottery studio", speech)).toBe(
      "I left my job in March to, uh, build a pottery studio",
    );
  });

  test("a near-quote counts when a long run of it is really theirs, and shows only that run", () => {
    const speech = userSpeech(
      "User: My dad just asked whether I had a plan for the kiln, which is the most engineer thing he could have said.",
    );
    // The model changed "just asked" to "simply asked" and trimmed the end.
    expect(
      groundExcerpt("My dad simply asked whether I had a plan for the kiln, which is the most engineer thing", speech),
    ).toBe("asked whether I had a plan for the kiln, which is the most engineer thing");
    // A changed word with too little real text around it still fails.
    expect(groundExcerpt("My dad simply asked whether I had money", speech)).toBeNull();
  });

  test("a quote spanning two consecutive user turns grounds, with the AI's line left out", () => {
    const speech = userSpeech(
      "User: The first month I sold forty mugs at the farmers market.\nAI: Wow.\nUser: And then a cafe ordered two hundred.",
    );
    expect(groundExcerpt("I sold forty mugs at the farmers market and then a cafe ordered two hundred", speech)).toBe(
      "I sold forty mugs at the farmers market. And then a cafe ordered two hundred",
    );
  });
});

describe("buildSessionPrompt", () => {
  test("orders base prompt, suffix, memory block and focus", () => {
    const prompt = buildSessionPrompt({
      basePrompt: "BASE",
      mode: "deep",
      memories: [{ kind: "goal", content: "Open a studio", importance: 5 }],
      recentSummaries: [{ date: "Oct 1, 2026", summary: "Talked about kilns." }],
      focus: "  pricing  ",
    });
    const order = ["BASE", "deep session", "Goal: Open a studio", "Oct 1, 2026: Talked about kilns.", "Today's focus: pricing"]
      .map((s) => prompt.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  test("leaves out the focus line when blank", () => {
    const prompt = buildSessionPrompt({ basePrompt: "BASE", mode: "quick", memories: [], recentSummaries: [], focus: "  " });
    expect(prompt).not.toContain("Today's focus");
  });
});
