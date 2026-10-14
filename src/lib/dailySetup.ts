// Daily family setup: what the adult child enters about their parent. Shared
// by the setup form and convex/daily.ts, so the browser and the server
// enforce exactly the same rules.

import { ASSISTANT_NAME } from "../config/brand";
import { emailError, isValidTimezone, normalizeEmail } from "./validation";

export const CHECK_ITEMS = ["meds", "sleep", "meals"] as const;
export type CheckItem = (typeof CHECK_ITEMS)[number];

export const CHECK_ITEM_LABEL: Record<CheckItem, string> = {
  meds: "Did they take their medicine?",
  sleep: "How did they sleep?",
  meals: "Have they eaten?",
};

export const CHECK_ITEM_SHORT: Record<CheckItem, string> = { meds: "Medicine", sleep: "Sleep", meals: "Meals" };

/** Sunday first, matching Date.getDay(). */
export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// Calls only happen between 8am and 9pm in the parent's own timezone.
export const EARLIEST_CALL = "08:00";
export const LATEST_CALL = "21:00";
export const MIN_WINDOW_MINUTES = 30;

export const NAME_MAX = 60;
export const TOPIC_MAX = 60;
export const TOPICS_MAX = 12;
export const EXTRA_RECIPIENTS_MAX = 5;

/** Half-hour steps from 8:00am to 9:00pm, as "HH:mm". */
export const CALL_TIMES: string[] = (() => {
  const times: string[] = [];
  for (let m = toMinutes(EARLIEST_CALL); m <= toMinutes(LATEST_CALL); m += 30) {
    times.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return times;
})();

/** US timezones first, since the pilot is in the US. */
export const COMMON_TIMEZONES: { value: string; label: string }[] = [
  { value: "America/New_York", label: "Eastern" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Phoenix", label: "Arizona" },
  { value: "America/Los_Angeles", label: "Pacific" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
];

export type FamilyMember = { name: string; email: string };

/** What the form sends. Phone numbers are as typed; the rest is already split. */
export type DailySetupInput = {
  parentName: string;
  parentPhone: string;
  timezone: string;
  days: number[];
  windowStart: string;
  windowEnd: string;
  talkAbout: string[];
  avoid: string[];
  checkItems: string[];
  familyMembers: FamilyMember[];
  emergencyName: string;
  emergencyPhone: string;
};

/** The cleaned values that get stored. Phone numbers are E.164, e.g. "+15551234567". */
export type DailySetup = Omit<DailySetupInput, "checkItems"> & { checkItems: CheckItem[] };

export type DailySetupField =
  | "parentName"
  | "parentPhone"
  | "timezone"
  | "days"
  | "window"
  | "talkAbout"
  | "avoid"
  | "familyMembers"
  | "emergencyName"
  | "emergencyPhone";

export type DailySetupErrors = Partial<Record<DailySetupField, string>>;

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * A US number with area code, or any number written with a leading "+" and
 * country code. Returns E.164, or null if it doesn't look like a phone number.
 */
export function normalizePhone(input: string): string | null {
  const value = input.trim();
  if (!/^[+\d\s().-]+$/.test(value)) return null;
  const digits = value.replace(/\D/g, "");
  if (value.startsWith("+")) {
    return digits.length >= 8 && digits.length <= 15 && !digits.startsWith("0") ? `+${digits}` : null;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** "+15551234567" → "(555) 123-4567"; other countries stay in E.164. */
export function formatPhone(e164: string): string {
  const us = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return us ? `(${us[1]}) ${us[2]}-${us[3]}` : e164;
}

/** "09:30" → "9:30am". */
export function formatTime(time: string): string {
  const minutes = toMinutes(time);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h < 12 ? "am" : "pm";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12}${suffix}` : `${hour12}:${String(m).padStart(2, "0")}${suffix}`;
}

/** [1,2,3,4,5] → "Weekdays"; all seven → "Every day"; otherwise "Mon, Wed, Fri". */
export function describeDays(days: number[]): string {
  const set = [...new Set(days)].sort((a, b) => a - b);
  if (set.length === 7) return "Every day";
  if (set.join() === "1,2,3,4,5") return "Weekdays";
  if (set.join() === "0,6") return "Weekends";
  return set.map((d) => DAY_LABELS[d]).join(", ");
}

/** Splits "garden, grandkids\nchurch" into ["garden", "grandkids", "church"]. */
export function splitTopics(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map(cleanText)
    .filter((t) => t.length > 0);
}

function topicsError(topics: string[]): string | null {
  if (topics.length > TOPICS_MAX) return `Keep it to ${TOPICS_MAX} topics or fewer.`;
  if (topics.some((t) => t.length > TOPIC_MAX)) return `Keep each topic under ${TOPIC_MAX} characters.`;
  return null;
}

function nameError(name: string, empty: string): string | null {
  if (name.length === 0) return empty;
  if (name.length > NAME_MAX) return `Keep it under ${NAME_MAX} characters.`;
  return null;
}

const PHONE_HELP = "Enter a phone number with area code, like (555) 123-4567.";

/** Checks and cleans the form. Either errors (field → message) or the cleaned setup. */
export function validateDailySetup(
  input: DailySetupInput,
): { ok: true; setup: DailySetup } | { ok: false; errors: DailySetupErrors } {
  const errors: DailySetupErrors = {};

  const parentName = cleanText(input.parentName);
  const nameProblem = nameError(parentName, `Add the name ${ASSISTANT_NAME} should use, like Mom or Margaret.`);
  if (nameProblem) errors.parentName = nameProblem;

  const parentPhone = normalizePhone(input.parentPhone);
  if (parentPhone === null) errors.parentPhone = PHONE_HELP;

  if (!isValidTimezone(input.timezone)) errors.timezone = "Pick the timezone your parent lives in.";

  const days = [...new Set(input.days)].sort((a, b) => a - b);
  if (days.length === 0 || days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    errors.days = "Pick at least one day.";
  }

  const { windowStart, windowEnd } = input;
  if (!CALL_TIMES.includes(windowStart) || !CALL_TIMES.includes(windowEnd)) {
    errors.window = "Pick times between 8am and 9pm.";
  } else if (toMinutes(windowEnd) - toMinutes(windowStart) < MIN_WINDOW_MINUTES) {
    errors.window = "The end time needs to be at least 30 minutes after the start time.";
  }

  const talkAbout = input.talkAbout.map(cleanText).filter((t) => t.length > 0);
  const talkProblem = topicsError(talkAbout);
  if (talkProblem) errors.talkAbout = talkProblem;

  const avoid = input.avoid.map(cleanText).filter((t) => t.length > 0);
  const avoidProblem = topicsError(avoid);
  if (avoidProblem) errors.avoid = avoidProblem;

  const checkItems = CHECK_ITEMS.filter((item) => input.checkItems.includes(item));

  const familyMembers: FamilyMember[] = [];
  for (const member of input.familyMembers) {
    const name = cleanText(member.name);
    const email = normalizeEmail(member.email);
    if (name.length === 0 && email.length === 0) continue;
    const problem = nameError(name, "Add a name for each person.") ?? (emailError(email) && "Check each email address.");
    if (problem) {
      errors.familyMembers = problem;
      break;
    }
    if (!familyMembers.some((m) => m.email === email)) familyMembers.push({ name, email });
  }
  if (familyMembers.length > EXTRA_RECIPIENTS_MAX) {
    errors.familyMembers = `You can add up to ${EXTRA_RECIPIENTS_MAX} other people.`;
  }

  const emergencyName = cleanText(input.emergencyName);
  const emergencyNameProblem = nameError(emergencyName, "Add who we should tell in an emergency.");
  if (emergencyNameProblem) errors.emergencyName = emergencyNameProblem;

  const emergencyPhone = normalizePhone(input.emergencyPhone);
  if (emergencyPhone === null) errors.emergencyPhone = PHONE_HELP;

  if (Object.keys(errors).length > 0 || parentPhone === null || emergencyPhone === null) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    setup: {
      parentName,
      parentPhone,
      timezone: input.timezone,
      days,
      windowStart,
      windowEnd,
      talkAbout,
      avoid,
      checkItems,
      familyMembers,
      emergencyName,
      emergencyPhone,
    },
  };
}
