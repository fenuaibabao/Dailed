"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { CopyButton } from "./CopyButton";

const DRAFT_SECTIONS = [
  { kind: "post", heading: "Posts" },
  { kind: "script", heading: "Short-video scripts" },
  { kind: "newsletter", heading: "Newsletter" },
  { kind: "idea", heading: "Ideas for next time" },
] as const;

function DeleteSession({ callId, onDeleted }: { callId: Id<"calls">; onDeleted?: () => void }) {
  const deleteSession = useMutation(api.privacy.deleteSession);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="border-t border-border pt-4">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          if (!window.confirm("Delete this session's transcript, drafts and memories? This can't be undone.")) return;
          setPending(true);
          setError(null);
          try {
            await deleteSession({ callId });
            onDeleted?.();
          } catch {
            setError("We couldn't delete this session. Please try again.");
          } finally {
            setPending(false);
          }
        }}
        className="rounded-md border border-border px-3 py-1.5 text-sm text-danger disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete this session"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function SessionResults({ callId, onDeleted }: { callId: Id<"calls">; onDeleted?: () => void }) {
  const outputs = useQuery(api.outputs.forCall, { callId });
  const weaves = useQuery(api.weaves.forCall, { callId });
  if (outputs === undefined) return <p className="text-muted">Loading results…</p>;
  if (outputs.length === 0) return <p className="text-muted">No drafts for this session.</p>;

  const summary = outputs.find((o) => o.kind === "session_summary");
  const themes = outputs.filter((o) => o.kind === "theme");

  return (
    <div className="space-y-8" data-testid="session-results">
      {summary && (
        <section>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold">Summary</h2>
            <CopyButton text={summary.body} />
          </div>
          <p className="mt-2 leading-relaxed">{summary.body}</p>
        </section>
      )}

      {weaves !== undefined && weaves.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Part of</h2>
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Weaves this session belongs to">
            {weaves.map((w) => (
              <li key={w._id} title={w.note} className="rounded-full border border-border bg-surface px-3 py-1 text-sm">
                {w.title}
                {w.sessionCount > 1 && <span className="text-muted"> · {w.sessionCount} sessions</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {themes.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Themes</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {themes.map((t) => (
              <li key={t._id}>{t.body}</li>
            ))}
          </ul>
        </section>
      )}

      {DRAFT_SECTIONS.map(({ kind, heading }) => {
        const items = outputs.filter((o) => o.kind === kind);
        if (items.length === 0) return null;
        return (
          <section key={kind}>
            <h2 className="text-lg font-semibold">{heading}</h2>
            <ul className="mt-3 space-y-3">
              {items.map((item) => {
                const copyText = item.title ? `${item.title}\n\n${item.body}` : item.body;
                return (
                  <li key={item._id} className="rounded-lg border border-border bg-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {item.platform && (
                          <p className="text-xs font-medium uppercase tracking-wide text-muted">
                            {item.platform}
                          </p>
                        )}
                        {item.title && <h3 className="font-medium">{item.title}</h3>}
                      </div>
                      <CopyButton text={copyText} />
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words">{item.body}</p>
                    {item.sourceExcerpt && (
                      <blockquote className="mt-3 border-l-2 border-border pl-3 text-sm text-muted">
                        You said: “{item.sourceExcerpt}”
                      </blockquote>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <DeleteSession callId={callId} onDeleted={onDeleted} />
    </div>
  );
}
