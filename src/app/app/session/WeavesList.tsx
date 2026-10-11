"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

function formatDay(ms: number) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(ms);
}

/** Topics that run through the person's sessions in this product. */
export function WeavesList({
  product,
  shownCallId,
  onSelectCall,
}: {
  product: string;
  shownCallId: Id<"calls"> | null;
  onSelectCall: (callId: Id<"calls">) => void;
}) {
  const { isAuthenticated } = useConvexAuth();
  const weaves = useQuery(api.weaves.listMine, isAuthenticated ? { product } : "skip");

  return (
    <section data-testid="weaves">
      <h2 className="section-title">Weaves</h2>
      <p className="mt-1 text-sm text-muted">Topics that keep coming up across your sessions.</p>
      {weaves === undefined ? (
        <p className="mt-2 text-muted">Loading…</p>
      ) : weaves.length === 0 ? (
        <p className="mt-2 text-muted">After a session, its main topics show up here and grow as you come back to them.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {weaves.map((weave) => (
            <li key={weave._id} className="card overflow-hidden">
              <details>
                <summary className="cursor-pointer list-none p-4 hover:bg-surface-2/60">
                  <span className="font-medium">{weave.title}</span>
                  <span className="block text-sm text-muted">
                    {weave.sessionCount} {weave.sessionCount === 1 ? "session" : "sessions"} · last{" "}
                    {formatDay(weave.updatedAt)}
                  </span>
                </summary>
                <div className="space-y-3 border-t border-border p-4">
                  <p className="text-sm leading-relaxed">{weave.summary}</p>
                  <ul className="space-y-1">
                    {weave.sessions.map((s) => (
                      <li key={s.callId}>
                        <button
                          type="button"
                          onClick={() => onSelectCall(s.callId)}
                          aria-current={s.callId === shownCallId ? "true" : undefined}
                          className="min-h-9 w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2 aria-[current=true]:bg-accent-surface aria-[current=true]:font-medium"
                        >
                          <span className="text-muted">{formatDay(s.when)}:</span> {s.note}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
