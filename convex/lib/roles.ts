import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

// Workspace roles. Owners run the workspace (roles, health-data mode),
// admins manage people (invite code, removing members), members take part.

export type OrgRole = Doc<"memberships">["role"];

export const NOT_A_MEMBER = "NOT_A_MEMBER";
export const FORBIDDEN = "FORBIDDEN";
export const LAST_OWNER = "LAST_OWNER";

const RANK: Record<OrgRole, number> = { member: 1, admin: 2, owner: 3 };

export function atLeast(role: OrgRole, minimum: OrgRole): boolean {
  return RANK[role] >= RANK[minimum];
}

/** Admins may remove members; only owners may remove admins or owners. */
export function canRemove(actor: OrgRole, target: OrgRole): boolean {
  return actor === "owner" || (actor === "admin" && target === "member");
}

export async function getMembership(
  ctx: QueryCtx,
  orgId: Id<"orgs">,
  userId: Id<"users">,
): Promise<Doc<"memberships"> | null> {
  return await ctx.db
    .query("memberships")
    .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
    .unique();
}

/**
 * The caller's membership, if their role is at least `minimum`. A workspace
 * that doesn't exist and one they aren't in throw the same error.
 */
export async function requireRole(
  ctx: QueryCtx,
  orgId: Id<"orgs">,
  userId: Id<"users">,
  minimum: OrgRole,
): Promise<Doc<"memberships">> {
  const membership = await getMembership(ctx, orgId, userId);
  if (membership === null) throw new ConvexError(NOT_A_MEMBER);
  if (!atLeast(membership.role, minimum)) throw new ConvexError(FORBIDDEN);
  return membership;
}

export async function ownerCount(ctx: QueryCtx, orgId: Id<"orgs">): Promise<number> {
  const members = await ctx.db
    .query("memberships")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  return members.filter((m) => m.role === "owner").length;
}
