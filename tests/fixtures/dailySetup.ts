import type { DailySetupInput } from "../../src/lib/dailySetup";

/** A complete, valid Daily setup as the form sends it. */
export const VALID_DAILY_SETUP: DailySetupInput = {
  parentName: "Mom",
  parentPhone: "(555) 123-4567",
  timezone: "America/Chicago",
  days: [1, 2, 3, 4, 5],
  windowStart: "09:00",
  windowEnd: "10:00",
  talkAbout: ["the garden", "grandkids"],
  avoid: ["politics"],
  checkItems: ["meds", "sleep"],
  familyMembers: [{ name: "Sam", email: "Sam@Example.com" }],
  emergencyName: "Linda (neighbor)",
  emergencyPhone: "555-987-6543",
};
