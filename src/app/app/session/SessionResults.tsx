"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { CopyButton } from "./CopyButton";
import { ASSISTANT_NAME } from "@/config/brand";

const DRAFT_SECTIONS = [
  { kind: "investor_update", heading: "Investor update" },
  { kind: "decision", heading: "What you decided" },
  { kind: "pitch", heading: "Your company story" },
  { kind: "post", heading: "Posts" },
  { kind: "script", heading: "Video scripts" },
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
          if (!window.confirm(`Delete everything from this talk: the words, what we made, and what ${ASSISTANT_NAME} remembers from it? You can't undo this.`)) return;
          setPending(true);
          setError(null);
          try {
            await deleteSession({ callId });
            onDeleted?.();
          } catch {
            setError("We couldn't delete this talk. Please try again.");
          } finally {
            setPending(false);
          }
        }}
        className="btn btn-danger"
      >
        {pending ? "Deleting…" : "Delete this talk"}
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
            <h2 className="section-title">What you talked about</h2>
            <CopyButton text={summary.body} />
          </div>
          <p className="mt-3 text-base leading-relaxed text-soft">{summary.body}</p>
        </section>
      )}

      {weaves !== undefined && weaves.length > 0 && (
        <section>
          <h2 className="section-title">Topics in this talk</h2>
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Topics in this talk">
            {weaves.map((w) => (
              <li key={w._id} title={w.note} className="chip">
                {w.title}
                {w.sessionCount > 1 && <span className="text-muted"> · {w.sessionCount} talks</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {themes.length > 0 && (
        <section>
          <h2 className="section-title">Big ideas</h2>
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
                        If a number says “check this number,” you didn&apos;t say it out loud. Fix it before you send.
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
