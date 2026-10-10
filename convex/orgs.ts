import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { LAST_OWNER, FORBIDDEN, atLeast, canRemove, getMembership, ownerCount, requireRole } from "./lib/roles";
import { orgRole } from "./schema";

export const ORG_NAME_MAX = 80;
export const INVALID_NAME = "INVALID_NAME";
export const INVITE_INVALID = "INVITE_INVALID";

// No look-alike characters (0/O, 1/I/L), so codes survive being read aloud.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 10;

function newInviteCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function cleanName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0 || trimmed.length > ORG_NAME_MAX) throw new ConvexError(INVALID_NAME);
  return trimmed;
}

/** Clears a user's active workspace if it is this one. */
async function clearActive(ctx: MutationCtx, userId: Id<"users">, orgId: Id<"orgs">) {
  const user = await ctx.db.get(userId);
  if (user?.activeOrgId === orgId) await ctx.db.patch(userId, { activeOrgId: undefined });
}

/** The caller's workspaces and which one new sessions use. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const orgs = [];
    for (const m of memberships) {
      const org = await ctx.db.get(m.orgId);
      if (org === null) continue;
      orgs.push({ _id: org._id, name: org.name, role: m.role, phiMode: org.phiMode });
    }
    orgs.sort((a, b) => a.name.localeCompare(b.name));
    const active = orgs.find((o) => o._id === user?.activeOrgId) ?? null;
    return { orgs, activeOrgId: active?._id ?? null };
  },
});

/** One workspace, for its members. Only admins and owners see the invite code. */
export const get = query({
  args: { orgId: v.id("orgs") },
  handler: async (ctx, { orgId }) => {
    const userId = await requireUserId(ctx);
    const me = await requireRole(ctx, orgId, userId, "member");
    const org = await ctx.db.get(orgId);
    if (org === null) throw new ConvexError(FORBIDDEN);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const members = [];
    for (const m of memberships) {
      const user = await ctx.db.get(m.userId);
      members.push({
        userId: m.userId,
        name: user?.name ?? null,
        email: user?.email ?? null,
        role: m.role,
        isMe: m.userId === userId,
      });
    }
    return {
      _id: org._id,
      name: org.name,
      phiMode: org.phiMode,
      myRole: me.role,
      inviteCode: atLeast(me.role, "admin") ? org.inviteCode : null,
      members,
    };
  },
});

/** Creates a workspace with the caller as its owner, and switches to it. */
export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await requireUserId(ctx);
    const orgId = await ctx.db.insert("orgs", {
      name: cleanName(name),
      createdBy: userId,
      phiMode: false,
      inviteCode: newInviteCode(),
    });
    await ctx.db.insert("memberships", { orgId, userId, role: "owner", joinedAt: Date.now() });
    await ctx.db.patch(userId, { activeOrgId: orgId });
    return orgId;
  },
});

export const rename = mutation({
  args: { orgId: v.id("orgs"), name: v.string() },
  handler: async (ctx, { orgId, name }) => {
    const userId = await requireUserId(ctx);
    await requireRole(ctx, orgId, userId, "admin");
    await ctx.db.patch(orgId, { name: cleanName(name) });
  },
});

/** Joins the workspace an invite code belongs to. Joining twice is a no-op. */
export const join = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await requireUserId(ctx);
    const normalized = normalizeCode(code);
    if (normalized.length !== CODE_LENGTH) throw new ConvexError(INVITE_INVALID);
    const org = await ctx.db
      .query("orgs")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", normalized))
      .unique();
    if (org === null) throw new ConvexError(INVITE_INVALID);
    if ((await getMembership(ctx, org._id, userId)) === null) {
      await ctx.db.insert("memberships", { orgId: org._id, userId, role: "member", joinedAt: Date.now() });
    }
    return org._id;
  },
});

/** Replaces the invite code, so the old one stops working. */
export const resetInviteCode = mutation({
  args: { orgId: v.id("orgs") },
  handler: async (ctx, { orgId }) => {
    const userId = await requireUserId(ctx);
    await requireRole(ctx, orgId, userId, "admin");
    await ctx.db.patch(orgId, { inviteCode: newInviteCode() });
  },
});

/** Owners change roles. A workspace always keeps at least one owner. */
export const setRole = mutation({
  args: { orgId: v.id("orgs"), userId: v.id("users"), role: orgRole },
  handler: async (ctx, { orgId, userId: targetId, role }) => {
    const userId = await requireUserId(ctx);
    await requireRole(ctx, orgId, userId, "owner");
    const target = await getMembership(ctx, orgId, targetId);
    if (target === null) throw new ConvexError(FORBIDDEN);
    if (target.role === "owner" && role !== "owner" && (await ownerCount(ctx, orgId)) === 1) {
      throw new ConvexError(LAST_OWNER);
    }
    await ctx.db.patch(target._id, { role });
  },
});

/** Removes someone else. Use leave() to remove yourself. */
export const removeMember = mutation({
  args: { orgId: v.id("orgs"), userId: v.id("users") },
  handler: async (ctx, { orgId, userId: targetId }) => {
    const userId = await requireUserId(ctx);
    const me = await requireRole(ctx, orgId, userId, "admin");
    if (targetId === userId) throw new ConvexError(FORBIDDEN);
    const target = await getMembership(ctx, orgId, targetId);
    if (target === null) return;
    if (!canRemove(me.role, target.role)) throw new ConvexError(FORBIDDEN);
    await ctx.db.delete(target._id);
    await clearActive(ctx, targetId, orgId);
  },
});

export const leave = mutation({
  args: { orgId: v.id("orgs") },
  handler: async (ctx, { orgId }) => {
    const userId = await requireUserId(ctx);
    const me = await requireRole(ctx, orgId, userId, "member");
    if (me.role === "owner" && (await ownerCount(ctx, orgId)) === 1) {
      throw new ConvexError(LAST_OWNER);
    }
    await ctx.db.delete(me._id);
    await clearActive(ctx, userId, orgId);
  },
});

/** Owners switch health-data mode on or off. */
export const setPhiMode = mutation({
  args: { orgId: v.id("orgs"), on: v.boolean() },
  handler: async (ctx, { orgId, on }) => {
    const userId = await requireUserId(ctx);
    await requireRole(ctx, orgId, userId, "owner");
    await ctx.db.patch(orgId, { phiMode: on });
  },
});

/** Picks the workspace new sessions belong to; null means personal. */
export const setActive = mutation({
  args: { orgId: v.union(v.null(), v.id("orgs")) },
  handler: async (ctx, { orgId }) => {
    const userId = await requireUserId(ctx);
    if (orgId !== null) await requireRole(ctx, orgId, userId, "member");
    await ctx.db.patch(userId, { activeOrgId: orgId ?? undefined });
  },
});
