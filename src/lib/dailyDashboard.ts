// What the family dashboard shows about Daily calls. Pure, so the numbers
// can be tested without a backend. Calls arrive once phone calls are built.

/** One Daily call as the family sees it. Everything the parent said is self-reported. */
export type DailyCallView = {
  at: number; // when the call was placed, UTC ms
  answered: boolean;
  durationSeconds: number | null;
  mood: string | null; // how they sounded, in plain words
  highlights: string[];
  checkIns: string[]; // e.g. "Said she took her morning pills."
  passOn: string | null; // anything they asked Remi to tell the family
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Answered calls out of all calls in the last seven days. */
export function callsThisWeek(calls: DailyCallView[], now: number): { answered: number; total: number } {
  const recent = calls.filter((c) => c.at > now - 7 * DAY_MS && c.at <= now);
  return { answered: recent.filter((c) => c.answered).length, total: recent.length };
}

/** How many of the most recent calls in a row were answered. */
export function answeredStreak(calls: DailyCallView[]): number {
  let streak = 0;
  for (const call of [...calls].sort((a, b) => b.at - a.at)) {
    if (!call.answered) break;
    streak++;
  }
  return streak;
}

/** The newest answered call, whose summary leads the dashboard. */
export function latestAnswered(calls: DailyCallView[]): DailyCallView | null {
  return [...calls].sort((a, b) => b.at - a.at).find((c) => c.answered) ?? null;
}

/** 380 → "6 minutes"; 50 → "under a minute". */
export function describeDuration(seconds: number | null): string {
  if (seconds === null) return "";
  if (seconds < 60) return "under a minute";
  const minutes = Math.round(seconds / 60);
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

/** "Tue, Oct 14, 9:10am" in the parent's timezone. */
export function formatCallTime(at: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const minute = get("minute") === "00" ? "" : `:${get("minute")}`;
  return `${get("weekday")}, ${get("month")} ${get("day")}, ${get("hour")}${minute}${get("dayPeriod").toLowerCase()}`;
}
