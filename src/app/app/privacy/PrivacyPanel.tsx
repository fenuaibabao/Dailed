"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { RETENTION_OPTIONS, describeActivity, formatWhen } from "@/lib/activity";

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function PrivacyPanel() {
  const { isAuthenticated } = useConvexAuth();
  const settings = useQuery(api.privacy.mySettings, isAuthenticated ? {} : "skip");
  const activity = useQuery(api.privacy.myActivity, isAuthenticated ? {} : "skip");
  const setRetention = useMutation(api.privacy.setRetention);
  const setRedaction = useMutation(api.privacy.setRedaction);
  const exportMine = useMutation(api.privacy.exportMine);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setPending(true);
    setError(null);
    try {
      await fn();
    } catch {
      setError("That didn't save. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="page-title">Your data</h1>
        <p className="mt-3 text-base text-soft">Choose how long sessions are kept, what transcripts hide, and get a copy of everything.</p>
      </div>

      <section className="card space-y-3 p-6">
        <label htmlFor="retention" className="block text-base font-semibold">
          Keep my sessions for
        </label>
        <select
          id="retention"
          value={settings?.retentionDays?.toString() ?? ""}
          disabled={settings === undefined || pending}
          onChange={(e) => run(() => setRetention({ days: e.target.value === "" ? null : Number(e.target.value) }))}
          className="field"
        >
          {RETENTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-sm text-muted">
          Older sessions&apos; transcripts, drafts and memories are deleted once a day. You keep a dated record that the
          session happened. A workspace&apos;s limit applies too, and the shorter one wins.
        </p>
      </section>

      <section className="card p-6">
        <label className="flex cursor-pointer items-start gap-3.5">
          <input
            type="checkbox"
            className="mt-0.5 h-[22px] w-[22px] shrink-0 cursor-pointer"
            checked={settings?.redactTranscripts ?? false}
            disabled={settings === undefined || pending}
            onChange={(e) => run(() => setRedaction({ on: e.target.checked }))}
          />
          <span>
            <span className="block text-base font-semibold">Hide emails and long numbers in my transcripts</span>
            <span className="block text-sm text-muted">
              Emails and phone, card or ID numbers are replaced before anything is saved or sent to the AI, and the audio
              recording isn&apos;t kept. Names and addresses aren&apos;t caught. Applies to new sessions.
            </span>
          </span>
        </label>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="text-base font-semibold">Download my data</h2>
        <p className="text-sm text-muted">
          One file with your profile, consents, sessions, transcripts, drafts, memories and Weaves.
        </p>
        <button
          type="button"
          disabled={!isAuthenticated || pending}
          onClick={() =>
            run(async () => {
              const data = await exportMine({});
              downloadJson(data, `my-data-${new Date().toISOString().slice(0, 10)}.json`);
            })
          }
          className="btn"
        >
          Download
        </button>
      </section>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <section>
        <h2 className="section-title">Recent activity</h2>
        {activity === undefined ? (
          <p className="mt-2 text-muted">Loading…</p>
        ) : activity.length === 0 ? (
          <p className="mt-2 text-muted">Changes to your settings and workspaces show up here.</p>
        ) : (
          <ul className="card mt-3 divide-y divide-border" data-testid="my-activity">
            {activity.map((a) => (
              <li key={a._id} className="flex flex-wrap justify-between gap-2 px-5 py-3 text-sm">
                <span>
                  {describeActivity(a.action, a.details)}
                  {a.workspace && <span className="text-muted"> · {a.workspace}</span>}
                  {a.bySystem && <span className="text-muted"> · automatic</span>}
                </span>
                <span className="font-mono text-[13px] text-muted">{formatWhen(a.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
