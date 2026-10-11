"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { CopyButton } from "./CopyButton";

const DRAFT_SECTIONS = [
  { kind: "investor_update", heading: "Investor update" },
  { kind: "decision", heading: "Decision log" },
  { kind: "pitch", heading: "Pitch narrative" },
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
        className="btn btn-danger"
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
        <section className="card p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="section-title">Summary</h2>
            <CopyButton text={summary.body} />
          </div>
          <p className="mt-3 text-base leading-relaxed text-soft">{summary.body}</p>
        </section>
      )}

      {weaves !== undefined && weaves.length > 0 && (
        <section>
          <h2 className="section-title">Part of</h2>
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Weaves this session belongs to">
            {weaves.map((w) => (
              <li key={w._id} title={w.note} className="chip">
                {w.title}
                {w.sessionCount > 1 && <span className="text-muted"> · {w.sessionCount} sessions</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {themes.length > 0 && (
        <section>
          <h2 className="section-title">Themes</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-soft marker:text-muted">
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
            <h2 className="section-title">{heading}</h2>
            <ul className="mt-3 space-y-3">
              {items.map((item) => {
                const copyText = item.title ? `${item.title}\n\n${item.body}` : item.body;
                return (
                  <li key={item._id} className="card p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {item.platform && (
                          <p className="mb-1.5">
                            <span className="tag">{item.platform}</span>
                          </p>
                        )}
                        {item.title && <h3 className="text-base font-semibold">{item.title}</h3>}
                      </div>
                      <CopyButton text={copyText} />
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words text-soft">
                      {kind === "decision" && <span className="font-medium">Why: </span>}
                      {item.body}
                    </p>
                    {item.body.includes("[check this number]") && (
                      <p className="notice notice-warn mt-3">
                        Numbers marked “check this number” weren&apos;t found in what you said. Fix them before sending.
                      </p>
                    )}
                    {item.sourceExcerpt && (
                      <blockquote className="mt-3 rounded-[10px] bg-surface-2 px-3.5 py-2.5 text-sm text-soft">
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
