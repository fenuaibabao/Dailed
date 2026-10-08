import { describe, expect, test } from "vitest";
import {
  emailError,
  isValidTimezone,
  nameError,
  normalizeEmail,
  passwordError,
} from "../../src/lib/validation";

describe("email", () => {
  test.each(["ada@example.com", " Ada@Example.COM "])("accepts %j", (email) => {
    expect(emailError(email)).toBeNull();
  });
  test.each(["", "ada", "ada@", "ada@example", "a da@example.com"])("rejects %j", (email) => {
    expect(emailError(email)).not.toBeNull();
  });
  test("normalizes case and whitespace", () => {
    expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
  });
});

describe("password", () => {
  test("accepts 8+ characters with a letter and a number", () => {
    expect(passwordError("correct1horse")).toBeNull();
  });
  test.each(["abc1", "onlyletters", "12345678", "a1".repeat(65)])("rejects %j", (pw) => {
    expect(passwordError(pw)).not.toBeNull();
  });
});

test("name must be non-blank", () => {
  expect(nameError("Ada")).toBeNull();
  expect(nameError("   ")).not.toBeNull();
});

test("timezone validation", () => {
  expect(isValidTimezone("Europe/Paris")).toBe(true);
  expect(isValidTimezone("Mars/Base")).toBe(false);
  expect(isValidTimezone("")).toBe(false);
});
