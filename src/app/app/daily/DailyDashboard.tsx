"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState, type ReactNode } from "react";
import { api } from "../../../../convex/_generated/api";
import { ASSISTANT_NAME } from "@/config/brand";
import {
  answeredStreak,
  callsThisWeek,
  describeDuration,
  formatCallTime,
  latestAnswered,
  type DailyCallView,
} from "@/lib/dailyDashboard";
import { CHECK_ITEM_SHORT, COMMON_TIMEZONES, describeDays, formatPhone, formatTime } from "@/lib/dailySetup";

export type SavedSetup = NonNullable<FunctionReturnType<typeof api.daily.mySetup>>;
export type DailyAlert = FunctionReturnType<typeof api.daily.myAlerts>[number];

export function timezoneLabel(value: string): string {
  return COMMON_TIMEZONES.find((tz) => tz.value === value)?.label ?? value.replace(/_/g, " ");
}

function Status({ saved }: { saved: SavedSetup }) {
  const name = saved.parentName;
  const [text, tone] = saved.paused
    ? ["Paused", "bg-surface-2 text-soft"]
    : saved.callConsent === "granted"
      ? [`Calling ${describeDays(saved.days).toLowerCase()}`, "bg-success-surface text-success"]
      : saved.callConsent === "not_asked"
        ? ["Waiting for the first call", "bg-accent-surface text-foreground"]
        : saved.callConsent === "declined"
          ? [`${name} said no to the calls`, "bg-danger-surface text-danger"]
          : [`${name} asked to stop the calls`, "bg-danger-surface text-danger"];
  return (
    <p className={`m-0 inline-flex items-center gap-2 self-start rounded-full px-3.5 py-1.5 text-[15px] ${tone}`} data-testid="daily-status">
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-current" />
      {text}
    </p>
  );
}

/** Things the family should know now. Shown on top; email delivery comes later. */
function Alerts({ alerts, timezone }: { alerts: DailyAlert[]; timezone: string }) {
  if (alerts.length === 0) return null;
  return (
    <section className="card flex flex-col gap-3 border border-danger-border bg-danger-surface p-6" aria-labelledby="alerts-h" data-testid="daily-alerts">
      <h2 id="alerts-h" className="section-title m-0">
        Needs your attention
      </h2>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {alerts.slice(0, 3).map((alert) => (
          <li key={alert.id} className="flex flex-col gap-0.5">
            <span className="text-[17px]">{alert.message}</span>
            <span className="text-sm text-muted">
              {formatCallTime(alert.at, timezone)}
              {alert.emailed ? " · Emailed to your family" : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="card flex min-w-0 flex-[1_1_220px] flex-col gap-1 p-5">
      <p className="eyebrow m-0">{label}</p>
      <p className="m-0 text-[32px] font-semibold leading-tight tracking-[-0.02em]">{value}</p>
      <p className="m-0 text-[15px] text-soft">{note}</p>
    </div>
  );
}

function LatestCall({ call, saved }: { call: DailyCallView | null; saved: SavedSetup }) {
  if (call === null) {
    return (
      <section className="card flex flex-col gap-2 p-6" aria-labelledby="latest-h">
        <h2 id="latest-h" className="section-title m-0">
          Latest call
        </h2>
        <p className="m-0 text-[17px] text-soft">
          After {ASSISTANT_NAME}&apos;s first call with {saved.parentName}, the summary shows up here: how they sounded,
          what they talked about, and anything they asked {ASSISTANT_NAME} to pass on.
        </p>
      </section>
    );
  }
  const parts: { label: string; body: string }[] = [
    {
      label: "The call",
      body: [`Talked for ${describeDuration(call.durationSeconds)}.`, call.mood && `Sounded ${call.mood}.`].filter(Boolean).join(" "),
    },
  ];
  if (call.highlights.length > 0) parts.push({ label: "Highlights", body: call.highlights.join(" ") });
  if (call.checkIns.length > 0) parts.push({ label: `${saved.parentName} said`, body: call.checkIns.join(" ") });
  if (call.passOn) parts.push({ label: "Passing on", body: call.passOn });
  return (
    <section className="card flex flex-col gap-4 p-6" aria-labelledby="latest-h">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="latest-h" className="section-title m-0">
          Latest call
        </h2>
        <span className="text-[15px] text-muted">{formatCallTime(call.at, saved.timezone)}</span>
      </div>
      <dl className="m-0 flex flex-col gap-3.5">
        {parts.map((part) => (
          <div key={part.label} className="flex flex-col gap-1">
            <dt className="eyebrow">{part.label}</dt>
            <dd className="m-0 text-[17px] leading-[1.6]">{part.body}</dd>
          </div>
        ))}
      </dl>
      <p className="m-0 text-sm text-muted">What {saved.parentName} says about medicine, sleep or meals is passed on as they said it.</p>
    </section>
  );
}

function RecentCalls({ calls, timezone }: { calls: DailyCallView[]; timezone: string }) {
  if (calls.length === 0) return null;
  return (
    <section className="card p-6" aria-labelledby="recent-h">
      <h2 id="recent-h" className="section-title m-0">
        Recent calls
      </h2>
      <ul className="mt-3 mb-0 list-none p-0">
        {[...calls]
          .sort((a, b) => b.at - a.at)
          .slice(0, 7)
          .map((call) => (
            <li key={call.at} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 border-t border-border py-3 first:border-t-0">
              <span className="text-[17px]">{formatCallTime(call.at, timezone)}</span>
              <span className={`text-[15px] ${call.answered ? "text-soft" : "font-medium text-danger"}`}>
                {call.answered ? `Answered, ${describeDuration(call.durationSeconds)}` : "No answer"}
              </span>
            </li>
          ))}
      </ul>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-border py-3.5 first:border-t-0 sm:flex-row sm:gap-6">
      <dt className="w-48 shrink-0 text-[15px] text-muted">{label}</dt>
      <dd className="m-0 text-[17px]">{children}</dd>
    </div>
  );
}

const CONSENT_TEXT: Record<SavedSetup["callConsent"], string> = {
  not_asked: "Not asked yet. Asked on the first call.",
  granted: "Said yes to the calls.",
  declined: `Said no. ${ASSISTANT_NAME} won't call.`,
  revoked: `Asked ${ASSISTANT_NAME} to stop calling.`,
};

function Setup({ saved, onEdit }: { saved: SavedSetup; onEdit: () => void }) {
  const setPaused = useMutation(api.daily.setPaused);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const list = (items: string[]) => (items.length > 0 ? items.join(", ") : "Nothing yet");

  async function togglePause() {
    setPending(true);
    setFailed(false);
    try {
      await setPaused({ paused: !saved.paused });
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card p-6" aria-labelledby="setup-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="setup-h" className="section-title m-0">
          Your setup
        </h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn min-h-12 text-[15px]" disabled={pending} onClick={togglePause}>
            {saved.paused ? "Resume calls" : "Pause calls"}
          </button>
          <button type="button" className="btn min-h-12 text-[15px]" onClick={onEdit}>
            Edit setup
          </button>
        </div>
      </div>
      {failed && (
        <p role="alert" className="mt-2 mb-0 text-danger">
          That didn&apos;t work. Please try again.
        </p>
      )}
      <dl className="mt-3 mb-0">
        <Row label="Phone">{formatPhone(saved.parentPhone)}</Row>
        <Row label="When">
          {describeDays(saved.days)}, between {formatTime(saved.windowStart)} and {formatTime(saved.windowEnd)} (
          {timezoneLabel(saved.timezone)} time)
        </Row>
        <Row label="Talk about">{list(saved.talkAbout)}</Row>
        <Row label="Stay away from">{list(saved.avoid)}</Row>
        <Row label="Check-ins">
          {saved.checkItems.length > 0 ? saved.checkItems.map((c) => CHECK_ITEM_SHORT[c]).join(", ") : "None"}
        </Row>
        <Row label="Summary goes to">{["You", ...saved.familyMembers.map((m) => `${m.name} (${m.email})`)].join(", ")}</Row>
        <Row label="Emergency contact">
          {saved.emergencyName}, {formatPhone(saved.emergencyPhone)}
        </Row>
        <Row label={`${saved.parentName}'s answer`}>{CONSENT_TEXT[saved.callConsent]}</Row>
      </dl>
    </section>
  );
}

/** The family's view once Daily is set up: how the calls are going, then the setup. */
export function DailyDashboard({
  saved,
  calls,
  alerts = [],
  onEdit,
  now = Date.now(),
}: {
  saved: SavedSetup;
  calls: DailyCallView[];
  alerts?: DailyAlert[];
  onEdit: () => void;
  now?: number;
}) {
  const week = callsThisWeek(calls, now);
  const streak = answeredStreak(calls);
  return (
    <div className="flex flex-col gap-5">
      <Status saved={saved} />
      <Alerts alerts={alerts} timezone={saved.timezone} />
      <div className="flex flex-wrap gap-4">
        <Stat
          label="This week"
          value={week.total === 0 ? "No calls yet" : `${week.answered} of ${week.total}`}
          note={week.total === 0 ? "Calls from the last 7 days show here." : "calls answered in the last 7 days"}
        />
        <Stat
          label="In a row"
          value={String(streak)}
          note={streak === 1 ? "call answered in a row" : "calls answered in a row"}
        />
      </div>
      <LatestCall call={latestAnswered(calls)} saved={saved} />
      <RecentCalls calls={calls} timezone={saved.timezone} />
      <Setup saved={saved} onEdit={onEdit} />
    </div>
  );
}
