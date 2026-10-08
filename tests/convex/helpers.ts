/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";
import { RECORDING_CONSENT_TEXT } from "../../src/lib/consent";

export const modules = import.meta.glob(["../../convex/**/*.ts", "../../convex/**/*.js", "!../../convex/**/*.d.ts"]);

export function newTest() {
  return convexTest(schema, modules);
}

export type TestConvex = ReturnType<typeof newTest>;

/** A signed-in client for a fresh user, the way getAuthUserId reads it. */
export async function signedInAs(t: TestConvex, name = "Ada") {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { name, email: `${name.toLowerCase()}@example.com`, timezone: "UTC" }),
  );
  return { userId, client: t.withIdentity({ subject: `${userId}|test-session` }) };
}

export const TEST_ASSISTANT_ID = "asst_test_123";

export async function seedApp(t: TestConvex) {
  process.env.REMI_ASSISTANT_ID = TEST_ASSISTANT_ID;
  return await t.mutation(internal.seed.run, {});
}

export async function grantConsent(t: TestConvex, userId: Id<"users">) {
  await t.run((ctx) =>
    ctx.db.insert("consents", {
      userId,
      kind: "recording",
      consentText: RECORDING_CONSENT_TEXT,
      grantedAt: Date.now(),
    }),
  );
}

/** Inserts a call row directly, bypassing start(). */
export async function insertCall(
  t: TestConvex,
  userId: Id<"users">,
  fields: Partial<{
    status: "queued" | "connecting" | "in_session" | "processing" | "completed" | "failed";
    vapiCallId: string;
    sensitive: boolean;
    transcript: string;
    durationSeconds: number;
  }> = {},
) {
  const { appId, personaId } = await seedApp(t);
  return await t.run((ctx) =>
    ctx.db.insert("calls", {
      userId,
      appId,
      personaId,
      mode: "quick",
      channel: "web",
      status: fields.status ?? "queued",
      sensitive: fields.sensitive ?? false,
      vapiCallId: fields.vapiCallId,
      transcript: fields.transcript,
      durationSeconds: fields.durationSeconds,
    }),
  );
}
