import { AUTH_ERROR, type AuthFormError } from "./authErrors";
import { emailError, nameError, passwordError } from "./validation";

export type Mode = "signIn" | "signUp";
export type FieldErrors = Partial<Record<AuthFormError["field"], AuthFormError>>;

export function validateAuthForm(
  mode: Mode,
  values: { name: string; email: string; password: string },
): FieldErrors {
  const errors: FieldErrors = {};
  if (mode === "signUp") {
    const name = nameError(values.name);
    if (name !== null) {
      errors.name = { field: "name", code: AUTH_ERROR.INVALID_NAME, message: name };
    }
  }
  const email = emailError(values.email);
  if (email !== null) {
    errors.email = { field: "email", code: AUTH_ERROR.INVALID_EMAIL, message: email };
  }
  if (mode === "signUp") {
    const password = passwordError(values.password);
    if (password !== null) {
      errors.password = {
        field: "password",
        code: AUTH_ERROR.WEAK_PASSWORD,
        message: password,
      };
    }
  } else if (values.password.length === 0) {
    errors.password = {
      field: "password",
      code: AUTH_ERROR.WRONG_PASSWORD,
      message: "Enter your password.",
    };
  }
  return errors;
}

export const PASSWORD_MISMATCH_MESSAGE = "Passwords don't match.";

// Sign-up only. The confirmation never leaves the browser; it only guards
// against a typo in the password the server does receive.
export function confirmPasswordError(password: string, confirmation: string): string | null {
  return password === confirmation ? null : PASSWORD_MISMATCH_MESSAGE;
}
