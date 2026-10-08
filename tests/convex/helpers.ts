/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

export const modules = import.meta.glob(["../../convex/**/*.ts", "../../convex/**/*.js", "!../../convex/**/*.d.ts"]);

export function newTest() {
  return convexTest(schema, modules);
}

export type TestConvex = ReturnType<typeof newTest>;

/** A signed-in client for a fresh user, the way getAuthUserId reads it. */
export async function signedInAs(t: TestConvex, name = "Ada") {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { name, email: `${name.toLowerCase()}@example.com` }),
  );
  return { userId, client: t.withIdentity({ subject: `${userId}|test-session` }) };
}
