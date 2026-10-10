import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export type AuditEntry = Omit<Doc<"auditLog">, "_id" | "_creationTime" | "at">;

/** Appends to the audit log. Never pass session content in details. */
export async function audit(ctx: MutationCtx, entry: AuditEntry): Promise<void> {
  await ctx.db.insert("auditLog", { ...entry, at: Date.now() });
}
