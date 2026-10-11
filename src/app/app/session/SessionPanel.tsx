"use client";

import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { RECORDING_CONSENT_TEXT } from "@/lib/consent";
import { grantRecordingConsent } from "./actions";
import { SessionResults } from "./SessionResults";
import { useVapiSession } from "./useVapiSession";
import { WeavesList } from "./WeavesList";

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
    <div className="card p-4">
      <label className="flex cursor-pointer items-start gap-3.5">
        <input
          type="checkbox"
          className="mt-0.5 h-[22px] w-[22px] shrink-0 cursor-pointer"
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
  const workspaces = useQuery(api.orgs.listMine, isAuthenticated ? {} : "skip");
  const workspace = workspaces?.orgs.find((o) => o._id === workspaces.activeOrgId) ?? null;
  const session = useVapiSession();
  const [focus, setFocus] = useState("");
  const [selectedCallId, setSelectedCallId] = useState<Id<"calls"> | null>(null);

  const activeCall = useQuery(
    api.calls.get,
    session.activeCallId !== null ? { callId: session.activeCallId } : "skip",
  );
  const isLive = activeCall !== undefined && LIVE_STATUSES.includes(activeCall.status);
  const busy = session.starting || isLive;

  const latestCompleted = calls?.find((c) => c.status === "completed" && !c.contentDeleted) ?? null;
  const shownCallId =
    selectedCallId ??
    (activeCall?.status === "completed" ? activeCall._id : null) ??
    latestCompleted?._id ??
    null;
  const hasConsent = consent !== undefined && consent !== null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-10">
      <div className="space-y-8">
        <section className="card space-y-5 p-6">
          <div>
            <p className="eyebrow">{product.name}</p>
            <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.02em]">Talk it through with Remi</h1>
          </div>

          {workspaces !== undefined && (
            <p className="text-sm text-muted" data-testid="session-workspace">
              Workspace: {workspace?.name ?? "Personal"}
              {workspace?.phiMode && " (health-data mode: sessions are off)"} ·{" "}
              <Link href="/app/workspaces">
                Change
              </Link>
            </p>
          )}

          {consent === null && <ConsentBox />}

          <div>
            <label htmlFor="focus" className="label">
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
              className="field"
            />
          </div>

          <div>
            <button
              type="button"
              disabled={!hasConsent || busy}
              onClick={() => session.begin(product.slug, focus)}
              className="btn btn-primary btn-lg w-full"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
              </svg>
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
              className="notice flex items-center justify-between gap-3 text-[15px] text-foreground"
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
                  className="btn btn-sm border-end bg-end text-white hover:bg-end hover:text-white hover:brightness-110"
                >
                  End session
                </button>
              )}
            </div>
          )}
        </section>

        <section>
          <h2 className="section-title">Past sessions</h2>
          {calls === undefined ? (
            <p className="mt-2 text-muted">Loading…</p>
          ) : calls.length === 0 ? (
            <p className="mt-2 text-muted">Your sessions will show up here.</p>
          ) : (
            <ul className="card mt-3 divide-y divide-border overflow-hidden">
              {calls.map((call) => (
                <li key={call._id}>
                  <button
                    type="button"
                    onClick={() => setSelectedCallId(call._id)}
                    disabled={call.status !== "completed" || call.contentDeleted}
                    aria-current={call._id === shownCallId ? "true" : undefined}
                    className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-surface-2/60 disabled:cursor-default disabled:hover:bg-transparent aria-[current=true]:bg-accent-surface aria-[current=true]:font-medium"
                  >
                    <span className="min-w-0 truncate">
                      {formatWhen(call.startedAt ?? call._creationTime)} ·{" "}
                      {call.productName ?? MODE_LABEL[call.mode]}
                      {call.durationSeconds !== null && ` · ${formatDuration(call.durationSeconds)}`}
                    </span>
                    <span className="shrink-0 font-mono text-[13px] text-muted">
                      {call.contentDeleted ? "Deleted" : STATUS_LABEL[call.status]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <WeavesList product={product.slug} shownCallId={shownCallId} onSelectCall={setSelectedCallId} />
      </div>

      <div className="min-w-0">
        {shownCallId !== null ? (
          <SessionResults callId={shownCallId} onDeleted={() => setSelectedCallId(null)} />
        ) : (
          <div className="rounded-2xl border border-dashed border-border-strong p-8 text-muted">
            After your first session, your summary, themes and drafts appear here.
          </div>
        )}
      </div>
    </div>
  );
}
