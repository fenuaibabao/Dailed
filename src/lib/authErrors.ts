// Error codes thrown by convex/passwordProvider.ts as ConvexError data. They
// travel to the browser as part of the error message (through the Next.js auth
// proxy), so the client matches on the code string.
export const AUTH_ERROR = {
  INVALID_EMAIL: "DIALED_INVALID_EMAIL",
  WEAK_PASSWORD: "DIALED_WEAK_PASSWORD",
  INVALID_NAME: "DIALED_INVALID_NAME",
  ACCOUNT_EXISTS: "DIALED_ACCOUNT_EXISTS",
  NO_ACCOUNT: "DIALED_NO_ACCOUNT",
  WRONG_PASSWORD: "DIALED_WRONG_PASSWORD",
  TOO_MANY_ATTEMPTS: "DIALED_TOO_MANY_ATTEMPTS",
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR)[keyof typeof AUTH_ERROR];

export type AuthFormError = {
  field: "email" | "password" | "name" | "form";
  code: AuthErrorCode | "SERVER_ERROR";
  message: string;
};

const MESSAGES: Record<AuthErrorCode, Omit<AuthFormError, "code">> = {
  [AUTH_ERROR.INVALID_EMAIL]: {
    field: "email",
    message: "Enter a valid email address, like name@example.com.",
  },
  [AUTH_ERROR.WEAK_PASSWORD]: {
    field: "password",
    message: "Use at least 8 characters, including a letter and a number.",
  },
  [AUTH_ERROR.INVALID_NAME]: { field: "name", message: "Enter your name." },
  [AUTH_ERROR.ACCOUNT_EXISTS]: {
    field: "form",
    message: "An account with this email already exists.",
  },
  [AUTH_ERROR.NO_ACCOUNT]: {
    field: "form",
    message: "We couldn't find an account with that email.",
  },
  [AUTH_ERROR.WRONG_PASSWORD]: {
    field: "password",
    message: "That password doesn't match this account.",
  },
  [AUTH_ERROR.TOO_MANY_ATTEMPTS]: {
    field: "form",
    message: "Too many attempts. Wait a few minutes and try again.",
  },
};

export function toAuthFormError(error: unknown): AuthFormError {
  const text = error instanceof Error ? error.message : String(error);
  for (const code of Object.values(AUTH_ERROR)) {
    if (text.includes(code)) return { code, ...MESSAGES[code] };
  }
  return {
    field: "form",
    code: "SERVER_ERROR",
    message: "Something went wrong on our side. Please try again.",
  };
}
