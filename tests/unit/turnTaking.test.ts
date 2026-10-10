import { describe, expect, test } from "vitest";
import { REMI_START_SPEAKING_PLAN } from "../../convex/lib/turnTaking";

const rules = REMI_START_SPEAKING_PLAN.customEndpointingRules;

// Mirrors Vapi: rules are tried in order with RegExp.test, first match wins.
function timeoutFor(customer: string, assistant = "Got a few minutes?"): number | null {
  for (const rule of rules) {
    const flags = rule.regexOptions?.some((o) => o.type === "ignore-case" && o.enabled) ? "i" : "";
    const text = rule.type === "customer" ? customer : assistant;
    if (new RegExp(rule.regex, flags).test(text)) return rule.timeoutSeconds;
  }
  return null;
}

describe("Remi's start-speaking plan", () => {
  test("short yes/no answers get a quick reply", () => {
    expect(timeoutFor("Yeah.")).toBe(1.2);
    expect(timeoutFor("sure")).toBe(1.2);
    expect(timeoutFor("Not really.")).toBe(1.2);
  });

  test("trailing off mid-thought waits longest", () => {
    expect(timeoutFor("I started the company because")).toBe(4);
    expect(timeoutFor("We moved to Lisbon and,")).toBe(4);
    expect(timeoutFor("It was, um...")).toBe(4);
    expect(timeoutFor("The hardest part was the")).toBe(4);
    expect(timeoutFor("so I called my brother,")).toBe(4);
  });

  test("finished sentences still leave room to think", () => {
    expect(timeoutFor("I've been working on a new podcast about cooking.")).toBe(2.5);
    expect(timeoutFor("Yeah, I have about ten minutes.")).toBe(2.5);
    expect(timeoutFor("Banana bread")).toBe(2.5);
  });

  test("a rule always matches, so dashboard or transcriber endpointing never takes over", () => {
    expect(timeoutFor("anything at all", "What's on your mind lately?")).not.toBe(null);
    expect(timeoutFor("Okay", "Hi, this is Remi.")).not.toBe(null);
  });

  test("Remi waits before speaking and stays within Vapi's limits", () => {
    expect(REMI_START_SPEAKING_PLAN.waitSeconds).toBeGreaterThanOrEqual(0.8);
    for (const rule of rules) {
      expect(rule.timeoutSeconds).toBeGreaterThan(0);
      expect(rule.timeoutSeconds).toBeLessThanOrEqual(15);
    }
  });
});
