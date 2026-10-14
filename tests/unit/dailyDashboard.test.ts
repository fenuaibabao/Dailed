import { describe, expect, test } from "vitest";
import {
  answeredStreak,
  callsThisWeek,
  describeDuration,
  formatCallTime,
  latestAnswered,
  type DailyCallView,
} from "../../src/lib/dailyDashboard";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 14, 15, 0);

function call(daysAgo: number, answered: boolean, mood: string | null = null): DailyCallView {
  return { at: NOW - daysAgo * DAY, answered, durationSeconds: answered ? 360 : null, mood, highlights: [], checkIns: [], passOn: null };
}

describe("family dashboard numbers", () => {
  const calls = [call(0, true, "cheerful"), call(1, true), call(2, false), call(3, true), call(8, true)];

  test("calls this week counts the last seven days", () => {
    expect(callsThisWeek(calls, NOW)).toEqual({ answered: 3, total: 4 });
    expect(callsThisWeek([], NOW)).toEqual({ answered: 0, total: 0 });
  });

  test("the streak stops at the first missed call", () => {
    expect(answeredStreak(calls)).toBe(2);
    expect(answeredStreak([call(0, false), call(1, true)])).toBe(0);
    expect(answeredStreak([])).toBe(0);
  });

  test("the latest summary is the newest answered call", () => {
    expect(latestAnswered([call(0, false), ...calls.slice(1)])?.at).toBe(NOW - DAY);
    expect(latestAnswered([call(0, false)])).toBeNull();
  });

  test("durations and times read plainly", () => {
    expect(describeDuration(50)).toBe("under a minute");
    expect(describeDuration(60)).toBe("1 minute");
    expect(describeDuration(380)).toBe("6 minutes");
    expect(describeDuration(null)).toBe("");
    expect(formatCallTime(Date.UTC(2026, 9, 14, 14, 10), "America/Chicago")).toBe("Wed, Oct 14, 9:10am");
    expect(formatCallTime(Date.UTC(2026, 9, 14, 14, 0), "America/Chicago")).toBe("Wed, Oct 14, 9am");
  });
});
