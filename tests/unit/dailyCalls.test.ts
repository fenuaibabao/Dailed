import { describe, expect, test } from "vitest";
import { decideCall, isNumberAllowed, localClock, RETRY_GAP_MS } from "../../src/lib/dailySchedule";
import { asksToStop, containsQuote, findConcerns } from "../../src/lib/dailySafety";
import { finalizeDailyResult, dailyResultSchema } from "../../convex/lib/dailyProcessing";
import { buildDailyPrompt, consentOpening, dailyFirstMessage } from "../../convex/lib/dailyPrompt";
import { buildVapiCallRequest, vapiCallIdFrom } from "../../convex/lib/dailyVapi";
import { wasAnswered } from "../../convex/dailyCalls";
import { ASSISTANT_NAME } from "../../src/config/brand";

// Monday 2026-10-19, 9:15am in Chicago (14:15 UTC).
const MON_915_CHICAGO = Date.parse("2026-10-19T14:15:00Z");
const MIN = 60 * 1000;

const schedule = {
  timezone: "America/Chicago",
  days: [1, 2, 3, 4, 5],
  windowStart: "09:00",
  windowEnd: "10:00",
};

describe("localClock", () => {
  test("reads the date, weekday and time in the parent's timezone", () => {
    expect(localClock(MON_915_CHICAGO, "America/Chicago")).toEqual({ dateKey: "2026-10-19", weekday: 1, minutes: 9 * 60 + 15 });
    // The same moment is already Tuesday morning in Tokyo.
    expect(localClock(MON_915_CHICAGO, "Asia/Tokyo")).toMatchObject({ dateKey: "2026-10-19", weekday: 1 });
    expect(localClock(Date.parse("2026-10-19T23:30:00Z"), "Asia/Tokyo")).toMatchObject({ dateKey: "2026-10-20", weekday: 2 });
  });
});

describe("decideCall", () => {
  test("calls once inside the window on a chosen day", () => {
    expect(decideCall({ ...schedule, now: MON_915_CHICAGO, todaysAttempts: [] })).toEqual({ call: true, attempt: 1 });
  });

  test("never calls outside the window, on other days, or outside 8am to 9pm", () => {
    expect(decideCall({ ...schedule, now: MON_915_CHICAGO + 60 * MIN, todaysAttempts: [] })).toMatchObject({
      call: false,
      reason: "outside_window",
    });
    expect(decideCall({ ...schedule, days: [0, 6], now: MON_915_CHICAGO, todaysAttempts: [] })).toMatchObject({
      call: false,
      reason: "not_today",
    });
    // A window stretching past 9pm is cut at 9pm.
    const at2110 = Date.parse("2026-10-20T02:10:00Z"); // 9:10pm Monday in Chicago
    expect(
      decideCall({ ...schedule, windowStart: "20:00", windowEnd: "23:00", now: at2110, todaysAttempts: [] }),
    ).toMatchObject({ call: false, reason: "outside_window" });
  });

  test("retries once, after a gap, only if the first call went unanswered", () => {
    const first = { at: MON_915_CHICAGO - 10 * MIN, unanswered: true };
    expect(decideCall({ ...schedule, now: MON_915_CHICAGO, todaysAttempts: [first] })).toMatchObject({
      call: false,
      reason: "waiting_to_retry",
    });
    const later = first.at + RETRY_GAP_MS;
    expect(decideCall({ ...schedule, windowEnd: "11:00", now: later, todaysAttempts: [first] })).toEqual({
      call: true,
      attempt: 2,
    });
    expect(
      decideCall({ ...schedule, windowEnd: "11:00", now: later, todaysAttempts: [{ ...first, unanswered: false }] }),
    ).toMatchObject({ call: false, reason: "done_today" });
    expect(
      decideCall({
        ...schedule,
        windowEnd: "12:00",
        now: later + RETRY_GAP_MS,
        todaysAttempts: [first, { at: later, unanswered: true }],
      }),
    ).toMatchObject({ call: false, reason: "done_today" });
  });
});

test("only numbers on the test list may be called, unless the pilot switch is on", () => {
  expect(isNumberAllowed("+15551234567", {})).toBe(false);
  expect(isNumberAllowed("+15551234567", { allowedNumbers: "+15550000000, +15551234567" })).toBe(true);
  expect(isNumberAllowed("+15551234567", { allowedNumbers: "+15550000000" })).toBe(false);
  expect(isNumberAllowed("+15551234567", { allowAll: "1" })).toBe(true);
});

describe("safety word lists", () => {
  test("catch falls, pain and calls for help in the parent's words", () => {
    expect(findConcerns("Well, I fell in the kitchen this morning.")).toEqual(["a fall"]);
    expect(findConcerns("My chest hurts a bit and I can't get up")).toEqual(["can't get up", "chest pain"]);
    expect(findConcerns("I need help")).toEqual(["a call for help"]);
    expect(findConcerns("The tomatoes fell off the vine, ha.")).toEqual([]);
    expect(findConcerns("Lovely day, I had my coffee.")).toEqual([]);
  });

  test("catch a request to stop calling", () => {
    expect(asksToStop("Please stop calling me.")).toBe(true);
    expect(asksToStop("Don't call me again")).toBe(true);
    expect(asksToStop("I can't stop calling my sister about it")).toBe(false);
  });

  test("find a quote despite punctuation and case", () => {
    expect(containsQuote("Oh yes, that's fine! Call anytime.", "yes that's fine")).toBe(true);
    expect(containsQuote("Oh yes, that's fine!", "yes absolutely")).toBe(false);
    expect(containsQuote("anything", "")).toBe(false);
  });
});

const CONSENT_TRANSCRIPT = [
  `AI: ${consentOpening("Mom", "Ada")}`,
  "User: Oh, sure, that's fine. Call me anytime.",
  "AI: Wonderful. How's the garden?",
  "User: The tomatoes are coming in nicely. Don't tell Ada, but I skipped lunch.",
].join("\n");

function raw(fields: Partial<Parameters<typeof dailyResultSchema.parse>[0]> = {}) {
  return dailyResultSchema.parse({ consent: "not_asked", ...fields });
}

describe("finalizeDailyResult", () => {
  const job = { transcript: CONSENT_TRANSCRIPT, parentName: "Mom", isConsentCall: true };

  test("a yes only counts with the parent's own words", () => {
    expect(finalizeDailyResult(raw({ consent: "yes", consent_quote: "sure, that's fine" }), job)).toMatchObject({
      consent: "granted",
      consentQuote: "sure, that's fine",
    });
    // Words the parent never said, or words from the AI's lines, aren't a yes.
    expect(finalizeDailyResult(raw({ consent: "yes", consent_quote: "yes please call daily" }), job).consent).toBe("unclear");
    expect(finalizeDailyResult(raw({ consent: "yes", consent_quote: "Is it OK if I call you" }), job).consent).toBe("unclear");
    expect(finalizeDailyResult(raw({ consent: "yes" }), job).consent).toBe("unclear");
  });

  test("a no counts even without a quote; consent is ignored on regular calls", () => {
    expect(finalizeDailyResult(raw({ consent: "no" }), job).consent).toBe("declined");
    expect(finalizeDailyResult(raw({ consent: "no" }), { ...job, isConsentCall: false }).consent).toBe("unchanged");
  });

  test("worrying words alert even if the model missed them; made-up quotes are dropped", () => {
    const transcript = "AI: How are you?\nUser: Not great, I fell last night but I'm okay now.";
    const outcome = finalizeDailyResult(
      raw({ concerns: [{ label: "dizziness", quote: "I felt so dizzy" }] }),
      { transcript, parentName: "Mom", isConsentCall: false },
    );
    expect(outcome.concerns).toEqual([{ label: "a fall", quote: null }]);
  });

  test("stop requests are caught by words too", () => {
    const transcript = "AI: Hi Mom.\nUser: Please stop calling me, dear.";
    expect(finalizeDailyResult(raw(), { transcript, parentName: "Mom", isConsentCall: false }).stopRequested).toBe(true);
  });
});

describe("prompts and the Vapi request", () => {
  test("the first call asks permission and says it's an AI and recorded; later calls still disclose", () => {
    const first = dailyFirstMessage({ parentName: "Mom", childName: "Ada", isConsentCall: true });
    expect(first).toBe(consentOpening("Mom", "Ada"));
    expect(first).toContain(`this is ${ASSISTANT_NAME}, an AI assistant`);
    expect(first).toContain("Calls are recorded");
    expect(first).toContain("Is it OK if I call you each day?");
    expect(consentOpening("Mom", "")).toContain("Your family set up");
    const later = dailyFirstMessage({ parentName: "Mom", childName: "Ada", isConsentCall: false });
    expect(later).toContain("AI");
    expect(later).toContain("recorded");
  });

  test("the prompt carries topics, things to avoid, check-ins and the safety rules", () => {
    const prompt = buildDailyPrompt({
      parentName: "Mom",
      childName: "Ada",
      isConsentCall: false,
      talkAbout: ["the garden"],
      avoid: ["politics"],
      checkItems: ["meds"],
      memories: [{ kind: "fact", content: "Grows tomatoes", importance: 3 }],
      recentSummaries: [],
    });
    expect(prompt).toContain("the garden");
    expect(prompt).toContain("Never bring up: politics");
    expect(prompt).toContain("Did they take their medicine?");
    expect(prompt).toContain("Grows tomatoes");
    expect(prompt).toContain("Please hang up and call 911 now.");
    expect(prompt).toContain("Never give medical advice");
    expect(prompt).not.toContain("FIRST call");
  });

  test("the request dials the parent from our number with per-call overrides", () => {
    const body = buildVapiCallRequest(
      {
        callId: "call_1",
        assistantId: "asst_1",
        phoneE164: "+15551234567",
        parentName: "Mom",
        firstMessage: "Hi Mom",
        systemPrompt: "prompt",
        provider: "openai",
        model: "gpt-4.1-mini",
        maxDurationSeconds: 1200,
      },
      "pn_1",
    );
    expect(body).toMatchObject({
      phoneNumberId: "pn_1",
      customer: { number: "+15551234567" },
      assistantId: "asst_1",
      assistantOverrides: {
        firstMessage: "Hi Mom",
        maxDurationSeconds: 1200,
        metadata: { call_id: "call_1" },
        model: { messages: [{ role: "system", content: "prompt" }] },
      },
    });
    expect(vapiCallIdFrom({ id: "vc_1" })).toBe("vc_1");
    expect(vapiCallIdFrom({ message: "bad" })).toBeNull();
  });

  test("a call counts as answered only when the parent spoke", () => {
    expect(wasAnswered({ endedReason: "customer-did-not-answer" })).toBe(false);
    expect(wasAnswered({ endedReason: "voicemail", transcript: "AI: Hi\nUser: Leave a message after the tone" })).toBe(false);
    expect(wasAnswered({ endedReason: "customer-ended-call", transcript: "AI: Hi Mom" })).toBe(false);
    expect(wasAnswered({ endedReason: "customer-ended-call", transcript: "AI: Hi Mom\nUser: Hello dear" })).toBe(true);
  });
});
