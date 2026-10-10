"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { RECORDING_CONSENT_TEXT } from "@/lib/consent";
import { grantRecordingConsent } from "./actions";
import { SessionResults } from "./SessionResults";
import { useVapiSession } from "./useVapiSession";

type Status = Doc<"calls">["status"];

const STATUS_LABEL: Record<Status, string> = {
  queued: "Getting ready…",
  connecting: "Connecting…",
  in_session: "In session",
  processing: "Processing your drafts…",
  completed: "Done",
  missed: "Missed",
  failed: "Didn't complete",
};

const LIVE_STATUSES: Status[] = ["queued", "connecting", "in_session"];
const FOCUS_MAX = 280;

function formatWhen(ms: number) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(ms);
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return "";
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

function ConsentBox() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4"
          disabled={saving}
          onChange={async (event) => {
            if (!event.target.checked) return;
            setSaving(true);
            setError(null);
            const result = await grantRecordingConsent();
            if (!result.ok) {
              setError("We couldn't save that. Please try again.");
              event.target.checked = false;
            }
            setSaving(false);
          }}
        />
        <span>{RECORDING_CONSENT_TEXT}</span>
      </label>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** The product this page runs, chosen by the URL the user came in through. */
export type SessionProduct = { slug: string; name: string };

const MODE_LABEL: Record<Doc<"calls">["mode"], string> = { quick: "Quick", deep: "Deep", open: "Session" };

export function SessionPanel({ product }: { product: SessionProduct }) {
  const { isAuthenticated } = useConvexAuth();
  const consent = useQuery(api.consents.myRecordingConsent, isAuthenticated ? {} : "skip");
  const calls = useQuery(api.calls.listMine, isAuthenticated ? {} : "skip");
  const session = useVapiSession();
  const [focus, setFocus] = useState("");
  const [selectedCallId, setSelectedCallId] = useState<Id<"calls"> | null>(null);

  const activeCall = useQuery(
    api.calls.get,
    session.activeCallId !== null ? { callId: session.activeCallId } : "skip",
  );
  const isLive = activeCall !== undefined && LIVE_STATUSES.includes(activeCall.status);
  const busy = session.starting || isLive;

  const latestCompleted = calls?.find((c) => c.status === "completed") ?? null;
  const shownCallId =
    selectedCallId ??
    (activeCall?.status === "completed" ? activeCall._id : null) ??
    latestCompleted?._id ??
    null;
  const hasConsent = consent !== undefined && consent !== null;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="space-y-8">
        <section className="space-y-4">
          <div>
            <p className="text-sm font-medium text-accent">{product.name}</p>
            <h1 className="mt-1 text-2xl font-semibold">Talk it through with Remi</h1>
          </div>

          {consent === null && <ConsentBox />}

          <div>
            <label htmlFor="focus" className="mb-1 block text-sm font-medium">
              Today&apos;s focus <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id="focus"
              rows={2}
              maxLength={FOCUS_MAX}
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              disabled={busy}
              placeholder="A launch, a story you keep telling, something that changed…"
              className="w-full rounded-md border border-border bg-surface px-3 py-2"
            />
          </div>

          <div>
            <button
              type="button"
              disabled={!hasConsent || busy}
              onClick={() => session.begin(product.slug, focus)}
              className="w-full rounded-md bg-accent px-4 py-2.5 font-medium text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              Start talking
            </button>
            <p className="mt-2 text-sm text-muted">
              Remi will ask how much time you have, from 10 minutes up to 90.
            </p>
          </div>

          {session.error && (
            <p role="alert" className="text-sm text-danger">
              {session.error}
            </p>
          )}

          {activeCall && (
            <div
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4"
              aria-live="polite"
              data-testid="call-status"
            >
              <div>
                <p className="font-medium">{STATUS_LABEL[activeCall.status]}</p>
                {activeCall.status === "failed" && (
                  <p className="text-sm text-muted">
                    {activeCall.processingError ?? "The session ended before it could be processed."}
                  </p>
                )}
              </div>
              {(activeCall.status === "in_session" || activeCall.status === "connecting") && (
                <button
                  type="button"
                  onClick={() => session.end()}
                  className="rounded-md border border-border px-3 py-1.5 text-sm"
                >
                  End session
                </button>
              )}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold">Past sessions</h2>
          {calls === undefined ? (
            <p className="mt-2 text-muted">Loading…</p>
          ) : calls.length === 0 ? (
            <p className="mt-2 text-muted">Your sessions will show up here.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {calls.map((call) => (
                <li key={call._id}>
                  <button
                    type="button"
                    onClick={() => setSelectedCallId(call._id)}
                    disabled={call.status !== "completed"}
                    aria-current={call._id === shownCallId ? "true" : undefined}
                    className="flex w-full items-center justify-between gap-3 py-2 text-left disabled:cursor-default aria-[current=true]:font-medium"
                  >
                    <span className="min-w-0 truncate">
                      {formatWhen(call.startedAt ?? call._creationTime)} ·{" "}
                      {call.productName ?? MODE_LABEL[call.mode]}
                      {call.durationSeconds !== null && ` · ${formatDuration(call.durationSeconds)}`}
                    </span>
                    <span className="shrink-0 text-sm text-muted">{STATUS_LABEL[call.status]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="min-w-0">
        {shownCallId !== null ? (
          <SessionResults callId={shownCallId} />
        ) : (
          <div className="rounded-lg border border-dashed border-border p-8 text-muted">
            After your first session, your summary, themes and drafts appear here.
          </div>
        )}
      </div>
    </div>
  );
}
