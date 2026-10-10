import { describe, expect, test } from "vitest";
import { makeFunctionReference } from "convex/server";
import type { DefaultFunctionArgs } from "convex/server";
import type { Id } from "../../convex/_generated/dataModel";
import { RECORDING_CONSENT_TEXT } from "../../src/lib/consent";
import {
  grantConsent,
  insertCall,
  modules,
  newTest,
  seedApp,
  signedInAs,
  type TestConvex,
} from "./helpers";

// Public functions that don't use the signed-in user, and why.
const PUBLIC_BY_DESIGN = new Set([
  "auth:signIn", // how you sign in
  "auth:signOut", // a no-op when signed out
  "auth:isAuthenticated", // answers "no" when signed out
  "vapiWebhook:recordEndOfCallReport", // gated by the webhook secret; see webhook.test.ts
]);

type Fixture = { t: TestConvex; userId: Id<"users"> };

// For each guarded function: valid arguments (so the test proves the auth
// check rejects the call, not argument validation), plus any data the call
// needs to succeed for its owner.
const CASES: Record<string, (f: Fixture) => Promise<DefaultFunctionArgs>> = {
  "users:viewer": async () => ({}),
  "apps:getBySlug": async () => ({ slug: "create" }),
  "personas:getDefaultForApp": async () => ({ slug: "create" }),
  "consents:myRecordingConsent": async () => ({}),
  "consents:grantRecording": async () => ({ consentText: RECORDING_CONSENT_TEXT }),
  "calls:start": async ({ t, userId }) => {
    await seedApp(t);
    await grantConsent(t, userId);
    return {};
  },
  "calls:reportClientStatus": async ({ t, userId }) => ({
    callId: await insertCall(t, userId),
    status: "connecting",
  }),
  "calls:get": async ({ t, userId }) => ({ callId: await insertCall(t, userId) }),
  "calls:listMine": async () => ({}),
  "outputs:forCall": async ({ t, userId }) => ({ callId: await insertCall(t, userId) }),
  "weaves:listMine": async ({ t }) => {
    await seedApp(t);
    return { product: "create" };
  },
  "weaves:forCall": async ({ t, userId }) => ({ callId: await insertCall(t, userId) }),
  "orgs:listMine": async () => ({}),
  "orgs:get": async (f) => ({ orgId: await ownedOrg(f) }),
  "orgs:create": async () => ({ name: "Acme" }),
  "orgs:rename": async (f) => ({ orgId: await ownedOrg(f), name: "Acme 2" }),
  "orgs:join": async ({ t }) => {
    const { userId: other } = await signedInAs(t, "Owner");
    const orgId = await ownedOrg({ t, userId: other });
    return { code: (await t.run((ctx) => ctx.db.get(orgId)))!.inviteCode };
  },
  "orgs:resetInviteCode": async (f) => ({ orgId: await ownedOrg(f) }),
  "orgs:setRole": async (f) => {
    const orgId = await ownedOrg(f);
    return { orgId, userId: await memberOf(f.t, orgId), role: "admin" };
  },
  "orgs:removeMember": async (f) => {
    const orgId = await ownedOrg(f);
    return { orgId, userId: await memberOf(f.t, orgId) };
  },
  "orgs:leave": async (f) => {
    const orgId = await ownedOrg(f);
    await addOwner(f.t, orgId);
    return { orgId };
  },
  "orgs:setPhiMode": async (f) => ({ orgId: await ownedOrg(f), on: true }),
  "orgs:setActive": async (f) => ({ orgId: await ownedOrg(f) }),
  "orgs:setRetention": async (f) => ({ orgId: await ownedOrg(f), days: 90 }),
  "orgs:setRedaction": async (f) => ({ orgId: await ownedOrg(f), on: true }),
  "orgs:activity": async (f) => ({ orgId: await ownedOrg(f) }),
  "privacy:mySettings": async () => ({}),
  "privacy:setRetention": async () => ({ days: 30 }),
  "privacy:setRedaction": async () => ({ on: true }),
  "privacy:deleteSession": async ({ t, userId }) => ({ callId: await insertCall(t, userId, { status: "completed" }) }),
  "privacy:exportMine": async () => ({}),
  "privacy:myActivity": async () => ({}),
};

/** A workspace owned by the fixture's user. */
async function ownedOrg({ t, userId }: Fixture): Promise<Id<"orgs">> {
  return await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("orgs", { name: "Acme", createdBy: userId, phiMode: false, inviteCode: "ABCDEFGHJK" });
    await ctx.db.insert("memberships", { orgId, userId, role: "owner", joinedAt: 0 });
    return orgId;
  });
}

async function memberOf(t: TestConvex, orgId: Id<"orgs">, role: "member" | "owner" = "member") {
  const { userId } = await signedInAs(t, `Member${Math.random().toString(36).slice(2, 7)}`);
  await t.run((ctx) => ctx.db.insert("memberships", { orgId, userId, role, joinedAt: 0 }));
  return userId;
}

/** A second owner, so the first can leave. */
async function addOwner(t: TestConvex, orgId: Id<"orgs">) {
  return await memberOf(t, orgId, "owner");
}

type FunctionKind = "query" | "mutation" | "action";
type Registered = { isQuery?: boolean; isMutation?: boolean; isAction?: boolean; isPublic?: boolean };

async function listPublicFunctions(): Promise<{ name: string; kind: FunctionKind }[]> {
  const found: { name: string; kind: FunctionKind }[] = [];
  for (const [path, load] of Object.entries(modules)) {
    if (path.includes("/_generated/")) continue;
    const moduleName = path.replace(/^.*\/convex\//, "").replace(/\.(ts|js)$/, "");
    const exports = (await load()) as Record<string, unknown>;
    for (const [exportName, value] of Object.entries(exports)) {
      if (value === null || (typeof value !== "function" && typeof value !== "object")) continue;
      const fn = value as Registered;
      if (fn.isPublic !== true) continue;
      const kind: FunctionKind | null = fn.isQuery
        ? "query"
        : fn.isMutation
          ? "mutation"
          : fn.isAction
            ? "action"
            : null;
      if (kind === null) continue;
      found.push({ name: `${moduleName}:${exportName}`, kind });
    }
  }
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

function call(client: Pick<TestConvex, "query" | "mutation" | "action">, name: string, kind: FunctionKind, args: DefaultFunctionArgs) {
  return kind === "query"
    ? client.query(makeFunctionReference<"query">(name), args)
    : kind === "mutation"
      ? client.mutation(makeFunctionReference<"mutation">(name), args)
      : client.action(makeFunctionReference<"action">(name), args);
}

describe("every public Convex function rejects unauthenticated access", async () => {
  const functions = await listPublicFunctions();
  const guarded = functions.filter((fn) => !PUBLIC_BY_DESIGN.has(fn.name));

  test("discovery finds the known public functions", () => {
    const names = functions.map((fn) => fn.name);
    for (const name of PUBLIC_BY_DESIGN) expect(names).toContain(name);
  });

  test("every guarded function has a case in this test", () => {
    const missing = guarded.map((fn) => fn.name).filter((name) => !(name in CASES));
    expect(missing, "add new public functions to CASES").toEqual([]);
    expect(guarded.length).toBeGreaterThan(0);
  });

  test.each(guarded)("$name ($kind) throws UNAUTHENTICATED when signed out", async ({ name, kind }) => {
    const t = newTest();
    const { userId } = await signedInAs(t);
    const args = await CASES[name]({ t, userId });
    await expect(call(t, name, kind, args)).rejects.toThrow("UNAUTHENTICATED");
  });

  test.each(guarded)("$name ($kind) works for the signed-in owner", async ({ name, kind }) => {
    const t = newTest();
    const { userId, client } = await signedInAs(t);
    const args = await CASES[name]({ t, userId });
    await expect(call(client, name, kind, args)).resolves.not.toThrow();
  });
});
