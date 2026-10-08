import { describe, expect, test } from "vitest";
import { makeFunctionReference } from "convex/server";
import type { DefaultFunctionArgs } from "convex/server";
import { modules, newTest, signedInAs } from "./helpers";

// Public functions that must work while signed out, and why.
const PUBLIC_BY_DESIGN = new Set([
  "auth:signIn", // how you sign in
  "auth:signOut", // a no-op when signed out
  "auth:isAuthenticated", // answers "no" when signed out
]);

// Valid arguments for each guarded function, so the test proves the auth check
// rejects the call rather than argument validation.
const SAMPLE_ARGS: Record<string, DefaultFunctionArgs> = {
  "users:viewer": {},
  "apps:getBySlug": { slug: "create" },
  "personas:getDefaultForApp": { slug: "create" },
};

type FunctionKind = "query" | "mutation" | "action";
type Registered = {
  isQuery?: boolean;
  isMutation?: boolean;
  isAction?: boolean;
  isPublic?: boolean;
};

async function listPublicFunctions(): Promise<{ name: string; kind: FunctionKind }[]> {
  const found: { name: string; kind: FunctionKind }[] = [];
  for (const [path, load] of Object.entries(modules)) {
    if (path.includes("/_generated/")) continue;
    const moduleName = path.replace(/^.*\/convex\//, "").replace(/\.(ts|js)$/, "");
    const exports = (await load()) as Record<string, unknown>;
    for (const [exportName, value] of Object.entries(exports)) {
      if (typeof value !== "function" && typeof value !== "object") continue;
      const fn = value as Registered;
      if (fn === null || fn.isPublic !== true) continue;
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

describe("every public Convex function rejects unauthenticated access", async () => {
  const functions = await listPublicFunctions();
  const guarded = functions.filter((fn) => !PUBLIC_BY_DESIGN.has(fn.name));

  test("discovers the Convex Auth functions, so discovery itself works", () => {
    const names = functions.map((fn) => fn.name);
    for (const name of PUBLIC_BY_DESIGN) expect(names).toContain(name);
  });

  test("every guarded function has sample args in this test", () => {
    const missing = guarded.map((fn) => fn.name).filter((name) => !(name in SAMPLE_ARGS));
    expect(missing, "add new public functions to SAMPLE_ARGS").toEqual([]);
    expect(guarded.length).toBeGreaterThan(0);
  });

  test.each(guarded)("$name ($kind) throws UNAUTHENTICATED when signed out", async ({ name, kind }) => {
    const t = newTest();
    const args = SAMPLE_ARGS[name] ?? {};
    const call =
      kind === "query"
        ? t.query(makeFunctionReference<"query">(name), args)
        : kind === "mutation"
          ? t.mutation(makeFunctionReference<"mutation">(name), args)
          : t.action(makeFunctionReference<"action">(name), args);
    await expect(call).rejects.toThrow("UNAUTHENTICATED");
  });

  test.each(guarded)("$name ($kind) works when signed in", async ({ name, kind }) => {
    const t = newTest();
    const { client } = await signedInAs(t);
    const args = SAMPLE_ARGS[name] ?? {};
    const call =
      kind === "query"
        ? client.query(makeFunctionReference<"query">(name), args)
        : kind === "mutation"
          ? client.mutation(makeFunctionReference<"mutation">(name), args)
          : client.action(makeFunctionReference<"action">(name), args);
    await expect(call).resolves.not.toThrow();
  });
});
