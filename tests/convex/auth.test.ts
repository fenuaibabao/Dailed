import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { AUTH_ERROR } from "../../src/lib/authErrors";
import { newTest } from "./helpers";

type Params = Record<string, string>;

function signUp(t: ReturnType<typeof newTest>, params: Params) {
  return t.action(api.auth.signIn, {
    provider: "password",
    params: { flow: "signUp", name: "Ada", timezone: "Europe/Paris", ...params },
  });
}

function signIn(t: ReturnType<typeof newTest>, params: Params) {
  return t.action(api.auth.signIn, {
    provider: "password",
    params: { flow: "signIn", ...params },
  });
}

describe("password auth", () => {
  test("sign-up creates the user with name, normalized email and timezone, and returns tokens", async () => {
    const t = newTest();
    const result = await signUp(t, { email: "  Ada@Example.com ", password: "correct1horse" });
    expect(result.tokens?.token).toBeTruthy();

    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      name: "Ada",
      email: "ada@example.com",
      timezone: "Europe/Paris",
    });
  });

  test("an invalid timezone falls back to UTC", async () => {
    const t = newTest();
    await signUp(t, { email: "ada@example.com", password: "correct1horse", timezone: "Mars/Base" });
    const user = await t.run((ctx) => ctx.db.query("users").first());
    expect(user?.timezone).toBe("UTC");
  });

  test("sign-in with the right password returns tokens", async () => {
    const t = newTest();
    await signUp(t, { email: "ada@example.com", password: "correct1horse" });
    const result = await signIn(t, { email: "ADA@example.com", password: "correct1horse" });
    expect(result.tokens?.token).toBeTruthy();
  });

  test("duplicate sign-up is rejected as an existing account", async () => {
    const t = newTest();
    await signUp(t, { email: "ada@example.com", password: "correct1horse" });
    await expect(
      signUp(t, { email: "Ada@example.com", password: "another1pass" }),
    ).rejects.toThrow(AUTH_ERROR.ACCOUNT_EXISTS);
  });

  test("sign-in for an unknown email reports no account", async () => {
    const t = newTest();
    await expect(
      signIn(t, { email: "nobody@example.com", password: "whatever1" }),
    ).rejects.toThrow(AUTH_ERROR.NO_ACCOUNT);
  });

  test("sign-in with the wrong password is rejected", async () => {
    const t = newTest();
    await signUp(t, { email: "ada@example.com", password: "correct1horse" });
    await expect(
      signIn(t, { email: "ada@example.com", password: "wrong1horse" }),
    ).rejects.toThrow(AUTH_ERROR.WRONG_PASSWORD);
  });

  test.each([
    ["invalid email", { email: "not-an-email", password: "correct1horse" }, AUTH_ERROR.INVALID_EMAIL],
    ["short password", { email: "ada@example.com", password: "abc1" }, AUTH_ERROR.WEAK_PASSWORD],
    ["password without a number", { email: "ada@example.com", password: "onlyletters" }, AUTH_ERROR.WEAK_PASSWORD],
    ["blank name", { email: "ada@example.com", password: "correct1horse", name: "   " }, AUTH_ERROR.INVALID_NAME],
  ])("server rejects sign-up with %s, even if the browser check is bypassed", async (_label, params, code) => {
    const t = newTest();
    await expect(signUp(t, params)).rejects.toThrow(code);
    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(0);
  });

  test("password reset is not available without an email provider", async () => {
    const t = newTest();
    await expect(
      t.action(api.auth.signIn, {
        provider: "password",
        params: { flow: "reset", email: "ada@example.com" },
      }),
    ).rejects.toThrow();
  });
});
