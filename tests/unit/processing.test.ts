import { describe, expect, test } from "vitest";
import {
  chunkTranscript,
  isLongSession,
  userSpeech,
} from "../../convex/lib/processing";
import { buildSessionPrompt } from "../../convex/lib/sessionPrompt";
import { MAX_WEAVES_PER_SESSION, buildWeaveInput, resolveAssignments } from "../../convex/lib/weaving";
import { redact } from "../../convex/lib/redaction";
import { checkRetention, effectiveRetention } from "../../convex/lib/retention";
import { BAA_COVERED_VENDORS, missingBaas } from "../../convex/lib/phi";
import { atLeast, canRemove } from "../../convex/lib/roles";

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

describe("weaving", () => {
  test("caps a session at three weaves and keeps existing weave names", () => {
    const candidates = [{ id: "a", title: "Podcast", summary: "s" }];
    const item = (ref: string | null, title: string) => ({ ref, title, summary: "x", note: "y" });
    const assignments = resolveAssignments(
      { weaves: [item("w1", "Renamed"), item(null, "B"), item(null, "b"), item(null, "C"), item(null, "D")] },
      candidates,
    );
    expect(assignments.map((a) => [a.weaveId, a.title])).toEqual([
      ["a", "Podcast"],
      [null, "B"],
      [null, "C"],
    ]);
    expect(MAX_WEAVES_PER_SESSION).toBe(3);
  });

  test("the prompt lists existing weaves by ref, never by id", () => {
    const input = buildWeaveInput([{ id: "secret-id", title: "Podcast", summary: "About the show." }], {
      summary: "You talked.",
      themes: [],
    });
    expect(input).toContain("w1: Podcast. About the show.");
    expect(input).not.toContain("secret-id");
  });
});

describe("roles and health-data mode", () => {
  test("role ranks and who can remove whom", () => {
    expect(atLeast("owner", "admin")).toBe(true);
    expect(atLeast("admin", "owner")).toBe(false);
    expect(atLeast("member", "member")).toBe(true);
    expect(canRemove("admin", "member")).toBe(true);
    expect(canRemove("admin", "admin")).toBe(false);
    expect(canRemove("owner", "admin")).toBe(true);
    expect(canRemove("member", "member")).toBe(false);
  });

  test("health-data sessions need a BAA from every vendor in the path", () => {
    expect(BAA_COVERED_VENDORS).toEqual([]);
    expect(missingBaas("openai")).toEqual(["vapi", "convex", "vercel", "openai"]);
    expect(missingBaas("openai", ["vapi", "convex", "vercel"])).toEqual(["openai"]);
    expect(missingBaas("openai", ["vapi", "convex", "vercel", "openai"])).toEqual([]);
  });
});

describe("redaction", () => {
  test("hides emails and runs of 9+ digits, keeps years, prices and short numbers", () => {
    const { text, count } = redact(
      "Mail jo.smith+work@mail.example.co.uk, call 07700 900123 or (555) 123-4567. SSN 123-45-6789, card 4111 1111 1111 1111. " +
        "In 2019 and 2020 we made $40,000 with 12 people, 3.5% growth, room 1204.",
    );
    expect(text).toBe(
      "Mail [email], call [number] or [number]. SSN [number], card [number]. " +
        "In 2019 and 2020 we made $40,000 with 12 people, 3.5% growth, room 1204.",
    );
    expect(count).toBe(5);
  });

  test("never joins lines", () => {
    expect(redact("User: 12345\nAI: 6789").text).toBe("User: 12345\nAI: 6789");
  });
});

describe("retention", () => {
  test("the shorter limit wins; none means keep", () => {
    expect(effectiveRetention(undefined, undefined)).toBeUndefined();
    expect(effectiveRetention(90, undefined)).toBe(90);
    expect(effectiveRetention(90, 30)).toBe(30);
    expect(checkRetention(null)).toBeUndefined();
    expect(() => checkRetention(45)).toThrow("INVALID_RETENTION");
  });
});
