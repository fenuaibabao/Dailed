import { expect, test } from "vitest";
import { AUTH_ERROR, toAuthFormError } from "../../src/lib/authErrors";
import { validateAuthForm } from "../../src/lib/authForm";

test("maps server error codes from a proxied error message", () => {
  const proxied = new Error(
    "[Request ID: abc] Server Error\nUncaught ConvexError: DIALED_ACCOUNT_EXISTS\n    at authorize",
  );
  expect(toAuthFormError(proxied)).toMatchObject({
    code: AUTH_ERROR.ACCOUNT_EXISTS,
    field: "form",
  });
  expect(toAuthFormError(new Error("DIALED_NO_ACCOUNT"))).toMatchObject({
    code: AUTH_ERROR.NO_ACCOUNT,
  });
  expect(toAuthFormError(new Error("DIALED_WRONG_PASSWORD"))).toMatchObject({
    field: "password",
  });
});

test("anything unrecognized is a generic server error, without leaking the raw message", () => {
  const result = toAuthFormError(new Error("Internal stack trace with secrets"));
  expect(result.code).toBe("SERVER_ERROR");
  expect(result.message).not.toContain("secrets");
});

test("client-side validation flags each bad field on sign-up", () => {
  const errors = validateAuthForm("signUp", { name: "", email: "nope", password: "short" });
  expect(Object.keys(errors).sort()).toEqual(["email", "name", "password"]);
});

test("sign-in only requires a password to be present, not a strong one", () => {
  expect(validateAuthForm("signIn", { name: "", email: "ada@example.com", password: "x" })).toEqual({});
  expect(validateAuthForm("signIn", { name: "", email: "ada@example.com", password: "" })).toHaveProperty("password");
});
