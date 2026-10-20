// When Daily places a call. Pure, so the rules can be tested without a
// backend: convex/dailyCalls.ts asks decideCall() for every schedule on each
// scheduler tick (every few minutes).
//
// Rules (docs/PRIMER.md, "The daily call"):
// - Only on the chosen days, inside the chosen window, in the parent's own time.
// - Never outside 8am to 9pm local, whatever the window says.
// - At most one call a day, plus one retry if the first went unanswered.

import { EARLIEST_CALL, LATEST_CALL, toMinutes } from "./dailySetup";

/** How long to wait after an unanswered call before the one retry. */
export const RETRY_GAP_MS = 45 * 60 * 1000;
/** Calls placed per parent per day: the first try and one retry. */
export const MAX_ATTEMPTS_PER_DAY = 2;

/** Vapi's ended reasons for a phone that wasn't picked up by a person. */
export const NOT_ANSWERED_REASONS: ReadonlySet<string> = new Set([
  "customer-did-not-answer",
  "customer-busy",
  "voicemail",
]);

export type LocalClock = {
  /** "YYYY-MM-DD" in the given timezone. */
  dateKey: string;
  /** 0 = Sunday. */
  weekday: number;
  /** Minutes since local midnight. */
  minutes: number;
};

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** The date, weekday and time of day at `now` in `timezone`. */
export function localClock(now: number, timezone: string): LocalClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: WEEKDAYS[get("weekday")] ?? 0,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

/** A call already placed today, as the scheduler sees it. */
export type TodaysAttempt = {
  at: number;
  /** True once we know nobody picked up (or placing the call failed). */
  unanswered: boolean;
};

export type CallDecision =
  | { call: true; attempt: number }
  | { call: false; reason: "not_today" | "outside_window" | "done_today" | "waiting_to_retry" };

/** Whether to place a call now, given the schedule and today's attempts so far. */
export function decideCall(args: {
  now: number;
  timezone: string;
  days: number[];
  windowStart: string;
  windowEnd: string;
  todaysAttempts: TodaysAttempt[];
}): CallDecision {
  const clock = localClock(args.now, args.timezone);
  if (!args.days.includes(clock.weekday)) return { call: false, reason: "not_today" };

  const start = Math.max(toMinutes(args.windowStart), toMinutes(EARLIEST_CALL));
  const end = Math.min(toMinutes(args.windowEnd), toMinutes(LATEST_CALL));
  if (clock.minutes < start || clock.minutes >= end) return { call: false, reason: "outside_window" };

  const attempts = [...args.todaysAttempts].sort((a, b) => a.at - b.at);
  if (attempts.length === 0) return { call: true, attempt: 1 };
  if (attempts.length >= MAX_ATTEMPTS_PER_DAY || attempts.some((a) => !a.unanswered)) {
    return { call: false, reason: "done_today" };
  }
  const last = attempts[attempts.length - 1];
  if (args.now - last.at < RETRY_GAP_MS) return { call: false, reason: "waiting_to_retry" };
  return { call: true, attempt: attempts.length + 1 };
}

/**
 * Who Daily may dial. While testing, only numbers on the allowlist
 * (DAILY_ALLOWED_NUMBERS, comma-separated E.164). Every number is allowed only
 * when DAILY_ALLOW_ALL_NUMBERS is "1", which is the switch for the pilot.
 */
export function isNumberAllowed(
  phoneE164: string,
  env: { allowedNumbers?: string; allowAll?: string },
): boolean {
  if (env.allowAll === "1") return true;
  const allowed = (env.allowedNumbers ?? "")
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n !== "");
  return allowed.includes(phoneE164);
}
