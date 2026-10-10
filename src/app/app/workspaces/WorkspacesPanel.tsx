"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useState, type FormEvent } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type Role = "owner" | "admin" | "member";

const ROLE_LABEL: Record<Role, string> = { owner: "Owner", admin: "Admin", member: "Member" };

const ERRORS: Record<string, string> = {
  INVALID_NAME: "Give the workspace a name of up to 80 characters.",
  INVITE_INVALID: "That code didn't match a workspace. Check it with whoever shared it.",
  LAST_OWNER: "A workspace needs at least one owner. Make someone else an owner first.",
  FORBIDDEN: "Your role in this workspace can't do that.",
  NOT_A_MEMBER: "You're no longer in this workspace.",
};

function errorText(error: unknown): string {
  const code = error instanceof ConvexError ? String(error.data) : "";
  return ERRORS[code] ?? "Something went wrong. Please try again.";
}

/** Runs a mutation, tracking pending state and a friendly error. */
function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => Promise<unknown>): Promise<boolean> {
    setPending(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setPending(false);
    }
  }
  return { pending, error, run };
}

function ErrorLine({ error }: { error: string | null }) {
  if (error === null) return null;
  return (
    <p role="alert" className="mt-2 text-sm text-danger">
      {error}
    </p>
  );
}

function NameForm({
  label,
  placeholder,
  button,
  onSubmit,
  inputId,
}: {
  label: string;
  placeholder: string;
  button: string;
  inputId: string;
  onSubmit: (value: string) => Promise<unknown>;
}) {
  const [value, setValue] = useState("");
  const action = useAction();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (await action.run(() => onSubmit(value))) setValue("");
  }
  return (
    <form onSubmit={submit} className="rounded-lg border border-border bg-surface p-4">
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          maxLength={80}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2"
        />
        <button
          type="submit"
          disabled={action.pending || value.trim() === ""}
          className="shrink-0 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {button}
        </button>
      </div>
      <ErrorLine error={action.error} />
    </form>
  );
}

function OrgDetails({ orgId }: { orgId: Id<"orgs"> }) {
  const org = useQuery(api.orgs.get, { orgId });
  const setRole = useMutation(api.orgs.setRole);
  const removeMember = useMutation(api.orgs.removeMember);
  const resetInviteCode = useMutation(api.orgs.resetInviteCode);
  const setPhiMode = useMutation(api.orgs.setPhiMode);
  const leave = useMutation(api.orgs.leave);
  const action = useAction();

  if (org === undefined) return <p className="p-4 text-muted">Loading…</p>;
  const isOwner = org.myRole === "owner";
  const isAdmin = isOwner || org.myRole === "admin";

  return (
    <div className="space-y-5 border-t border-border p-4">
      {org.inviteCode !== null && (
        <div>
          <p className="text-sm font-medium">Invite code</p>
          <p className="text-sm text-muted">Share it with people you want in this workspace. They enter it on this page.</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <code className="rounded-md border border-border px-3 py-1.5 font-mono tracking-widest" data-testid="invite-code">
              {org.inviteCode}
            </code>
            <button
              type="button"
              disabled={action.pending}
              onClick={() => action.run(() => resetInviteCode({ orgId }))}
              className="rounded-md border border-border px-3 py-1.5 text-sm"
            >
              New code
            </button>
          </div>
        </div>
      )}

      <div>
        <p className="text-sm font-medium">Health-data mode</p>
        <p className="text-sm text-muted">
          For workspaces that would handle patient information. While it&apos;s on, sessions in this workspace stay off
          until our vendors sign health-data agreements (BAAs).
        </p>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={org.phiMode}
            disabled={!isOwner || action.pending}
            onChange={(e) => action.run(() => setPhiMode({ orgId, on: e.target.checked }))}
          />
          {org.phiMode ? "On" : "Off"}
          {!isOwner && <span className="text-muted">(owners can change this)</span>}
        </label>
      </div>

      <div>
        <p className="text-sm font-medium">People</p>
        <ul className="mt-2 divide-y divide-border">
          {org.members.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0 truncate">
                {m.name ?? m.email ?? "Unnamed"}
                {m.isMe && <span className="text-muted"> (you)</span>}
                {m.email && m.name && <span className="block truncate text-sm text-muted">{m.email}</span>}
              </span>
              <span className="flex items-center gap-2">
                {isOwner && !m.isMe ? (
                  <select
                    aria-label={`Role for ${m.name ?? m.email ?? "member"}`}
                    value={m.role}
                    disabled={action.pending}
                    onChange={(e) => action.run(() => setRole({ orgId, userId: m.userId, role: e.target.value as Role }))}
                    className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                  >
                    {(["owner", "admin", "member"] as const).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm text-muted">{ROLE_LABEL[m.role]}</span>
                )}
                {isAdmin && !m.isMe && (isOwner || m.role === "member") && (
                  <button
                    type="button"
                    disabled={action.pending}
                    onClick={() => action.run(() => removeMember({ orgId, userId: m.userId }))}
                    className="rounded-md border border-border px-2 py-1 text-sm"
                  >
                    Remove
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <button
          type="button"
          disabled={action.pending}
          onClick={() => action.run(() => leave({ orgId }))}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-danger"
        >
          Leave workspace
        </button>
      </div>
      <ErrorLine error={action.error} />
    </div>
  );
}

export function WorkspacesPanel() {
  const { isAuthenticated } = useConvexAuth();
  const mine = useQuery(api.orgs.listMine, isAuthenticated ? {} : "skip");
  const create = useMutation(api.orgs.create);
  const join = useMutation(api.orgs.join);
  const setActive = useMutation(api.orgs.setActive);
  const switching = useAction();
  const [openId, setOpenId] = useState<Id<"orgs"> | null>(null);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Workspaces</h1>
        <p className="mt-1 text-muted">
          Use a workspace for a team, like a company or a clinic. Your sessions stay private to you either way.
        </p>
      </div>

      <section>
        <label htmlFor="active-workspace" className="mb-1 block text-sm font-medium">
          New sessions go to
        </label>
        <select
          id="active-workspace"
          value={mine?.activeOrgId ?? ""}
          disabled={mine === undefined || switching.pending}
          onChange={(e) =>
            switching.run(() => setActive({ orgId: e.target.value === "" ? null : (e.target.value as Id<"orgs">) }))
          }
          className="w-full rounded-md border border-border bg-surface px-3 py-2"
        >
          <option value="">Personal</option>
          {mine?.orgs.map((o) => (
            <option key={o._id} value={o._id}>
              {o.name}
              {o.phiMode ? " (health-data mode)" : ""}
            </option>
          ))}
        </select>
        <ErrorLine error={switching.error} />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Your workspaces</h2>
        {mine === undefined ? (
          <p className="text-muted">Loading…</p>
        ) : mine.orgs.length === 0 ? (
          <p className="text-muted">None yet. Create one or join with a code below.</p>
        ) : (
          <ul className="space-y-2">
            {mine.orgs.map((o) => (
              <li key={o._id} className="rounded-lg border border-border bg-surface" data-testid="workspace">
                <button
                  type="button"
                  aria-expanded={openId === o._id}
                  onClick={() => setOpenId(openId === o._id ? null : o._id)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left"
                >
                  <span className="min-w-0 truncate font-medium">{o.name}</span>
                  <span className="shrink-0 text-sm text-muted">
                    {ROLE_LABEL[o.role]}
                    {o.phiMode && " · health-data mode"}
                  </span>
                </button>
                {openId === o._id && <OrgDetails orgId={o._id} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <NameForm
          inputId="new-workspace"
          label="Create a workspace"
          placeholder="Company or clinic name"
          button="Create"
          onSubmit={(name) => create({ name })}
        />
        <NameForm
          inputId="join-code"
          label="Join with a code"
          placeholder="ABCDE23456"
          button="Join"
          onSubmit={(code) => join({ code })}
        />
      </section>
    </div>
  );
}
