import { describe, expect, test } from "vitest";
import {
  chunkTranscript,
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
