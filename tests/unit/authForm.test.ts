import { describe, expect, test } from "vitest";
import { confirmPasswordError, PASSWORD_MISMATCH_MESSAGE } from "../../src/lib/authForm";

describe("confirm password", () => {
  test("matching passwords pass", () => {
    expect(confirmPasswordError("correct1horse", "correct1horse")).toBeNull();
  });
  test.each([
    ["correct1horse", ""],
    ["correct1horse", "correct1hors"],
    ["correct1horse", "Correct1horse"],
    ["correct1horse", "correct1horse "],
  ])("%j vs %j is a mismatch", (password, confirmation) => {
    expect(confirmPasswordError(password, confirmation)).toBe(PASSWORD_MISMATCH_MESSAGE);
  });
  test("uses the exact wording", () => {
    expect(PASSWORD_MISMATCH_MESSAGE).toBe("Passwords don't match.");
  });
});
