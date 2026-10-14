import { describe, expect, test } from "vitest";
import {
  CALL_TIMES,
  describeDays,
  formatPhone,
  formatTime,
  normalizePhone,
  splitTopics,
  validateDailySetup,
} from "../../src/lib/dailySetup";
import { VALID_DAILY_SETUP } from "../fixtures/dailySetup";

describe("phone numbers", () => {
  test.each([
    ["(555) 123-4567", "+15551234567"],
    ["555.123.4567", "+15551234567"],
    ["1 555 123 4567", "+15551234567"],
    ["+1 (555) 123-4567", "+15551234567"],
    ["+44 20 7946 0958", "+442079460958"],
  ])("%s becomes %s", (typed, e164) => {
    expect(normalizePhone(typed)).toBe(e164);
  });

  test.each(["", "123-4567", "555-123-45678", "call me", "+0 555 123 4567", "+1"])("%j is rejected", (typed) => {
    expect(normalizePhone(typed)).toBeNull();
  });

  test("US numbers display the usual way", () => {
    expect(formatPhone("+15551234567")).toBe("(555) 123-4567");
    expect(formatPhone("+442079460958")).toBe("+442079460958");
  });
});

describe("times and days", () => {
  test("calls are offered from 8am to 9pm in half hours", () => {
    expect(CALL_TIMES[0]).toBe("08:00");
    expect(CALL_TIMES.at(-1)).toBe("21:00");
    expect(CALL_TIMES).toHaveLength(27);
  });

  test("times read like a person writes them", () => {
    expect(formatTime("08:00")).toBe("8am");
    expect(formatTime("09:30")).toBe("9:30am");
    expect(formatTime("12:00")).toBe("12pm");
    expect(formatTime("21:00")).toBe("9pm");
  });

  test("days have plain names", () => {
    expect(describeDays([0, 1, 2, 3, 4, 5, 6])).toBe("Every day");
    expect(describeDays([5, 4, 3, 2, 1])).toBe("Weekdays");
    expect(describeDays([6, 0])).toBe("Weekends");
    expect(describeDays([1, 3, 5])).toBe("Mon, Wed, Fri");
  });

  test("topics split on commas and new lines", () => {
    expect(splitTopics(" garden,  grandkids\nchurch ,, ")).toEqual(["garden", "grandkids", "church"]);
  });
});

describe("validateDailySetup", () => {
  test("cleans a valid setup", () => {
    const result = validateDailySetup({ ...VALID_DAILY_SETUP, days: [5, 1, 1], checkItems: ["sleep", "meds", "bogus"] });
    expect(result).toEqual({
      ok: true,
      setup: {
        ...VALID_DAILY_SETUP,
        parentPhone: "+15551234567",
        emergencyPhone: "+15559876543",
        days: [1, 5],
        checkItems: ["meds", "sleep"],
        familyMembers: [{ name: "Sam", email: "sam@example.com" }],
      },
    });
  });

  test("names every problem field", () => {
    const result = validateDailySetup({
      ...VALID_DAILY_SETUP,
      parentName: " ",
      parentPhone: "12",
      timezone: "Mars/Olympus",
      days: [],
      windowStart: "10:00",
      windowEnd: "10:00",
      talkAbout: Array.from({ length: 13 }, (_, i) => `topic ${i}`),
      avoid: ["x".repeat(61)],
      familyMembers: [{ name: "Sam", email: "not-an-email" }],
      emergencyName: "",
      emergencyPhone: "",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(
      ["avoid", "days", "emergencyName", "emergencyPhone", "familyMembers", "parentName", "parentPhone", "talkAbout", "timezone", "window"].sort(),
    );
  });

  test("calls stay between 8am and 9pm", () => {
    const early = validateDailySetup({ ...VALID_DAILY_SETUP, windowStart: "07:30" });
    expect(early.ok || early.errors.window).toBe("Pick times between 8am and 9pm.");
    const late = validateDailySetup({ ...VALID_DAILY_SETUP, windowEnd: "21:30" });
    expect(late.ok).toBe(false);
  });

  test("blank family rows are ignored and duplicates merged", () => {
    const result = validateDailySetup({
      ...VALID_DAILY_SETUP,
      familyMembers: [
        { name: "", email: "" },
        { name: "Sam", email: "sam@example.com" },
        { name: "Sammy", email: "SAM@example.com" },
      ],
    });
    expect(result.ok && result.setup.familyMembers).toEqual([{ name: "Sam", email: "sam@example.com" }]);
  });

  test("a family row needs a name and a valid email", () => {
    const noName = validateDailySetup({ ...VALID_DAILY_SETUP, familyMembers: [{ name: "", email: "sam@example.com" }] });
    expect(noName.ok || noName.errors.familyMembers).toBe("Add a name for each person.");
    const badEmail = validateDailySetup({ ...VALID_DAILY_SETUP, familyMembers: [{ name: "Sam", email: "sam@" }] });
    expect(badEmail.ok || badEmail.errors.familyMembers).toBe("Check each email address.");
  });
});
