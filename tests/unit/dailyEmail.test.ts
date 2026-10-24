import { describe, expect, test } from "vitest";
import { alertEmail, summaryEmail } from "../../convex/lib/dailyEmail";
import { DEFAULT_SPEND_CAP_USD, estimateSpend, IN_FLIGHT_ESTIMATE_USD, spendCapUsd } from "../../convex/lib/spend";
import { ASSISTANT_NAME } from "../../src/config/brand";

const AT = Date.parse("2026-10-19T14:15:00Z");
const summary = {
  parentName: "Mom",
  timezone: "America/Chicago",
  at: AT,
  durationSeconds: 380,
  mood: "cheerful",
  highlights: ["Talked about the tomatoes."],
  checkIns: ["Said she took her morning pills."],
  passOn: null,
};
const owner = { ownerName: "Ada", isOwner: true, siteUrl: "https://dailed.vercel.app/" };
const member = { ownerName: "Ada", isOwner: false, siteUrl: "https://dailed.vercel.app" };

describe("summary email", () => {
  test("says how the call went in plain words, in text and HTML", () => {
    const email = summaryEmail(summary, owner);
    expect(email.subject).toBe("Today's call with Mom");
    expect(email.text).toContain(`Mom talked with ${ASSISTANT_NAME} for 6 minutes. Sounded cheerful.`);
    expect(email.text).toContain("Mon, Oct 19, 9:15am");
    expect(email.text).toContain("Said she took her morning pills.");
    expect(email.text).toContain("It is not a doctor or an emergency service.");
    expect(email.text).toContain("https://dailed.vercel.app/app/daily");
    expect(email.html).toContain("Talked about the tomatoes.");
  });

  test("a message to pass on leads the subject", () => {
    expect(summaryEmail({ ...summary, passOn: "Says hi to Sam." }, owner).subject).toBe("Mom has a message for you");
  });

  test("other family members are told who added them and how to stop", () => {
    const email = summaryEmail(summary, member);
    expect(email.text).toContain("Ada added you to");
    expect(email.text).toContain("ask them to remove you");
    expect(email.text).not.toContain("/app/daily");
  });

  test("the parent's words can't inject HTML", () => {
    const email = summaryEmail({ ...summary, highlights: ['<script>alert("x")</script>'] }, owner);
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });
});

describe("alert email", () => {
  test("a worry tells them to call 911 in an emergency", () => {
    const email = alertEmail({ parentName: "Mom", kind: "concern", message: "On today's call, Mom mentioned a fall." }, owner);
    expect(email.subject).toBe("Please check in with Mom");
    expect(email.text).toContain("On today's call, Mom mentioned a fall.");
    expect(email.text).toContain("Call 911.");
  });

  test("each kind has its own subject", () => {
    const kinds = ["no_answer_twice", "concern", "declined", "unclear", "stopped"] as const;
    const subjects = kinds.map((kind) => alertEmail({ parentName: "Mom", kind, message: "x" }, owner).subject);
    expect(new Set(subjects).size).toBe(kinds.length);
  });
});

describe("spend cap", () => {
  test("reads the cap from the setting, with a safe default", () => {
    expect(spendCapUsd(undefined)).toBe(DEFAULT_SPEND_CAP_USD);
    expect(spendCapUsd("")).toBe(DEFAULT_SPEND_CAP_USD);
    expect(spendCapUsd("abc")).toBe(DEFAULT_SPEND_CAP_USD);
    expect(spendCapUsd("-5")).toBe(DEFAULT_SPEND_CAP_USD);
    expect(spendCapUsd("50")).toBe(50);
  });

  test("adds known costs and estimates calls still running", () => {
    expect(
      estimateSpend([
        { status: "completed", costUsd: 0.26 },
        { status: "missed", costUsd: 0.01 },
        { status: "connecting", costUsd: undefined },
        { status: "failed", costUsd: undefined },
      ]),
    ).toBe(0.27 + IN_FLIGHT_ESTIMATE_USD);
  });
});
