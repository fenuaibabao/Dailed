"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { RETENTION_OPTIONS, describeActivity, formatWhen } from "@/lib/activity";
import { ASSISTANT_NAME } from "@/config/brand";

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
        <p className="mt-3 text-base text-soft">Pick how long we keep your talks, what we hide, and get a copy of everything we have.</p>
      </div>

      <section className="card space-y-3 p-6">
        <label htmlFor="retention" className="block text-base font-semibold">
          Keep my talks for
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
          Once a day, we delete older talks: the words, what we made, and what {ASSISTANT_NAME} remembers from them. We keep only the
          date each talk happened. If your workspace has a limit too, the shorter one wins.
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
            <span className="block text-base font-semibold">Hide emails and long numbers in my talks</span>
            <span className="block text-sm text-muted">
              We swap out emails and phone, card or ID numbers before saving your words or sending them to the computer that
              writes your results, and we don&apos;t keep the sound recording. Names and addresses aren&apos;t caught. Works
              for new talks.
            </span>
          </span>
        </label>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="text-base font-semibold">Download my data</h2>
        <p className="text-sm text-muted">
          One file with everything: your profile, what you agreed to, your talks and their words, what we made, what {ASSISTANT_NAME} remembers, and your topics.
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
          <p className="mt-2 text-muted">When you change a setting or a workspace, it shows up here.</p>
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
