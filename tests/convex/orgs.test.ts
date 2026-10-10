import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { grantConsent, newTest, seedApp, signedInAs, type TestConvex } from "./helpers";

type Client = Awaited<ReturnType<typeof signedInAs>>["client"];

async function inviteCode(t: TestConvex, orgId: Id<"orgs">) {
  return (await t.run((ctx) => ctx.db.get(orgId)))!.inviteCode;
}

/** An owner, an admin and a member in one workspace. */
async function team(t: TestConvex) {
  const owner = await signedInAs(t, "Olive");
  const admin = await signedInAs(t, "Abe");
  const member = await signedInAs(t, "Mo");
  const orgId = await owner.client.mutation(api.orgs.create, { name: "  Acme   Clinic " });
  const code = await inviteCode(t, orgId);
  await admin.client.mutation(api.orgs.join, { code });
  await member.client.mutation(api.orgs.join, { code: code.toLowerCase().replace(/(.{5})/, "$1-") });
  await owner.client.mutation(api.orgs.setRole, { orgId, userId: admin.userId, role: "admin" });
  return { owner, admin, member, orgId };
}

async function roleOf(client: Client, orgId: Id<"orgs">) {
  const { orgs } = await client.query(api.orgs.listMine, {});
  return orgs.find((o) => o._id === orgId)?.role ?? null;
}

describe("workspaces", () => {
  test("creating makes you the owner and switches new sessions to it", async () => {
    const t = newTest();
    const { client } = await signedInAs(t);
    const orgId = await client.mutation(api.orgs.create, { name: "  Acme   Clinic " });
    const mine = await client.query(api.orgs.listMine, {});
    expect(mine).toEqual({ orgs: [{ _id: orgId, name: "Acme Clinic", role: "owner", phiMode: false }], activeOrgId: orgId });
    await expect(client.mutation(api.orgs.create, { name: "   " })).rejects.toThrow("INVALID_NAME");
  });

  test("people join with the invite code, which admins can replace", async () => {
    const t = newTest();
    const { owner, admin, member, orgId } = await team(t);
    expect(await roleOf(member.client, orgId)).toBe("member");
    expect(await roleOf(admin.client, orgId)).toBe("admin");

    // Joining again changes nothing.
    await member.client.mutation(api.orgs.join, { code: await inviteCode(t, orgId) });
    expect((await owner.client.query(api.orgs.get, { orgId })).members).toHaveLength(3);

    // Members don't see the code; admins do and can replace it.
    expect((await member.client.query(api.orgs.get, { orgId })).inviteCode).toBeNull();
    const old = await inviteCode(t, orgId);
    expect((await admin.client.query(api.orgs.get, { orgId })).inviteCode).toBe(old);
    await admin.client.mutation(api.orgs.resetInviteCode, { orgId });
    const late = await signedInAs(t, "Late");
    await expect(late.client.mutation(api.orgs.join, { code: old })).rejects.toThrow("INVITE_INVALID");
    await expect(member.client.mutation(api.orgs.resetInviteCode, { orgId })).rejects.toThrow("FORBIDDEN");
  });

  test("outsiders can't see or change a workspace", async () => {
    const t = newTest();
    const { orgId } = await team(t);
    const { client: outsider } = await signedInAs(t, "Eve");
    await expect(outsider.query(api.orgs.get, { orgId })).rejects.toThrow("NOT_A_MEMBER");
    await expect(outsider.mutation(api.orgs.setPhiMode, { orgId, on: true })).rejects.toThrow("NOT_A_MEMBER");
    await expect(outsider.mutation(api.orgs.setActive, { orgId })).rejects.toThrow("NOT_A_MEMBER");
    await expect(outsider.mutation(api.orgs.rename, { orgId, name: "Mine" })).rejects.toThrow("NOT_A_MEMBER");
  });

  test("only owners change roles and health-data mode", async () => {
    const t = newTest();
    const { admin, member, orgId } = await team(t);
    await expect(
      admin.client.mutation(api.orgs.setRole, { orgId, userId: member.userId, role: "admin" }),
    ).rejects.toThrow("FORBIDDEN");
    await expect(admin.client.mutation(api.orgs.setPhiMode, { orgId, on: true })).rejects.toThrow("FORBIDDEN");
    await expect(member.client.mutation(api.orgs.rename, { orgId, name: "x" })).rejects.toThrow("FORBIDDEN");
    await admin.client.mutation(api.orgs.rename, { orgId, name: "Acme Health" });
  });

  test("admins remove members but not other admins or owners; owners remove anyone", async () => {
    const t = newTest();
    const { owner, admin, member, orgId } = await team(t);
    await expect(
      admin.client.mutation(api.orgs.removeMember, { orgId, userId: owner.userId }),
    ).rejects.toThrow("FORBIDDEN");
    await member.client.mutation(api.orgs.setActive, { orgId });
    await admin.client.mutation(api.orgs.removeMember, { orgId, userId: member.userId });
    expect(await member.client.query(api.orgs.listMine, {})).toEqual({ orgs: [], activeOrgId: null });
    await owner.client.mutation(api.orgs.removeMember, { orgId, userId: admin.userId });
    expect((await owner.client.query(api.orgs.get, { orgId })).members.map((m) => m.role)).toEqual(["owner"]);
  });

  test("a workspace always keeps an owner", async () => {
    const t = newTest();
    const { owner, admin, orgId } = await team(t);
    await expect(owner.client.mutation(api.orgs.leave, { orgId })).rejects.toThrow("LAST_OWNER");
    await expect(
      owner.client.mutation(api.orgs.setRole, { orgId, userId: owner.userId, role: "member" }),
    ).rejects.toThrow("LAST_OWNER");
    await owner.client.mutation(api.orgs.setRole, { orgId, userId: admin.userId, role: "owner" });
    await owner.client.mutation(api.orgs.leave, { orgId });
    expect(await roleOf(owner.client, orgId)).toBeNull();
  });

  test("a new session belongs to the active workspace", async () => {
    const t = newTest();
    await seedApp(t);
    const { userId, client } = await signedInAs(t);
    await grantConsent(t, userId);
    const orgId = await client.mutation(api.orgs.create, { name: "Acme" });
    const first = await client.mutation(api.calls.start, {});
    await client.mutation(api.orgs.setActive, { orgId: null });
    const second = await client.mutation(api.calls.start, {});
    const rows = await t.run(async (ctx) => [await ctx.db.get(first.callId), await ctx.db.get(second.callId)]);
    expect(rows.map((r) => r?.orgId)).toEqual([orgId, undefined]);
  });

  test("health-data mode blocks sessions until every vendor has a BAA", async () => {
    const t = newTest();
    await seedApp(t);
    const { userId, client } = await signedInAs(t);
    await grantConsent(t, userId);
    const orgId = await client.mutation(api.orgs.create, { name: "Clinic" });
    await client.mutation(api.orgs.setPhiMode, { orgId, on: true });
    await expect(client.mutation(api.calls.start, {})).rejects.toThrow("PHI_NOT_READY");
    expect(await t.run((ctx) => ctx.db.query("calls").collect())).toEqual([]);

    // Personal sessions still work.
    await client.mutation(api.orgs.setActive, { orgId: null });
    await expect(client.mutation(api.calls.start, {})).resolves.toHaveProperty("callId");
  });

  test("a session ignores a workspace the user was removed from", async () => {
    const t = newTest();
    await seedApp(t);
    const { userId, client } = await signedInAs(t);
    await grantConsent(t, userId);
    const orgId = await client.mutation(api.orgs.create, { name: "Clinic" });
    await client.mutation(api.orgs.setPhiMode, { orgId, on: true });
    await t.run(async (ctx) => {
      const m = await ctx.db
        .query("memberships")
        .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
        .unique();
      await ctx.db.delete(m!._id);
    });
    const { callId } = await client.mutation(api.calls.start, {});
    expect((await t.run((ctx) => ctx.db.get(callId)))?.orgId).toBeUndefined();
  });
});
