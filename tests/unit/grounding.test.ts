import { describe, expect, test } from "vitest";
import { groundQuote, isGroundedQuote } from "../../convex/lib/grounding";
import { finalizeResult, sessionResultSchema, userSpeech } from "../../convex/lib/processing";
import { SESSION_226_MODEL_REPLY, SESSION_226_TRANSCRIPT } from "../fixtures/session226";

const speech = userSpeech(
  "AI: Tell me more.\nUser: Honestly, um, the scariest part was telling my parents about leaving my job in March!",
);

describe("groundQuote", () => {
  test("keeps exact quotes, ignoring case, punctuation and fillers", () => {
    expect(groundQuote("The scariest part — was telling my parents.", speech)).toEqual({
      status: "kept",
      excerpt: "the scariest part was telling my parents",
    });
    expect(groundQuote("Honestly the scariest part was telling", speech).status).toBe("kept");
  });

  test("fixes a quote with a small word shifted, using the user's own words", () => {
    // 13 words, one changed: about 92% similar.
    const outcome = groundQuote("the scariest part was telling my parents about quitting my job in March", speech);
    expect(outcome).toEqual({
      status: "fixed",
      how: "similar",
      excerpt: "the scariest part was telling my parents about leaving my job in March",
    });
  });

  test("fixes a clear paraphrase of one moment", () => {
    const outcome = groundQuote("Telling my parents I was leaving my job was the scariest part", speech);
    expect(outcome.status).toBe("fixed");
    if (outcome.status === "fixed") expect(outcome.excerpt).toContain("scariest part was telling my parents");
  });

  test("drops quotes the user never said, the AI's lines, and fragments", () => {
    expect(groundQuote("I raised two million dollars from investors last year", speech).status).toBe("dropped");
    expect(isGroundedQuote("Tell me more about it please", speech)).toBe(false);
    expect(isGroundedQuote("my parents", speech)).toBe(false);
  });
});

describe("the 226-second session", () => {
  test("now yields its posts and script with every quote kept or fixed", () => {
    const result = sessionResultSchema.parse(SESSION_226_MODEL_REPLY);
    const processed = finalizeResult(result, SESSION_226_TRANSCRIPT, false);
    expect(processed.posts).toHaveLength(2);
    expect(processed.scripts).toHaveLength(1);
    expect(processed.grounding).toEqual({ drafts: 3, quotesKept: 0, quotesFixed: 3, quotesDropped: 0 });
    const userWords = userSpeech(SESSION_226_TRANSCRIPT).replace(/\s+/g, " ");
    for (const draft of [...processed.posts, ...processed.scripts]) {
      expect(userWords).toContain(draft.sourceExcerpt);
    }
    expect(processed.noDraftsReason).toBeNull();
  });
});
