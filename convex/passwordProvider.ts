import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { createAccount, retrieveAccount } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { Scrypt } from "lucia";
import type { DataModel } from "./_generated/dataModel";
import { AUTH_ERROR } from "../src/lib/authErrors";
import {
  emailError,
  isValidTimezone,
  nameError,
  normalizeEmail,
  passwordError,
} from "../src/lib/validation";

export const PASSWORD_PROVIDER_ID = "password";

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function stringParam(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Email + password sign-up and sign-in. Same storage and hashing as Convex
 * Auth's built-in Password provider, but every expected failure is a
 * ConvexError with a stable code, because plain Error messages are redacted
 * in production and the forms need to tell the cases apart.
 */
export const DialedPassword = ConvexCredentials<DataModel>({
  id: PASSWORD_PROVIDER_ID,
  authorize: async (params, ctx) => {
    const email = normalizeEmail(stringParam(params.email));
    const password = stringParam(params.password);
    if (emailError(email) !== null) {
      throw new ConvexError(AUTH_ERROR.INVALID_EMAIL);
    }

    if (params.flow === "signUp") {
      if (passwordError(password) !== null) {
        throw new ConvexError(AUTH_ERROR.WEAK_PASSWORD);
      }
      const name = stringParam(params.name).trim();
      if (nameError(name) !== null) {
        throw new ConvexError(AUTH_ERROR.INVALID_NAME);
      }
      const timezone = stringParam(params.timezone);
      try {
        const { user } = await createAccount(ctx, {
          provider: PASSWORD_PROVIDER_ID,
          account: { id: email, secret: password },
          profile: {
            email,
            name,
            timezone: isValidTimezone(timezone) ? timezone : "UTC",
          },
          shouldLinkViaEmail: false,
          shouldLinkViaPhone: false,
        });
        return { userId: user._id };
      } catch (error) {
        if (errorText(error).includes("already exists")) {
          throw new ConvexError(AUTH_ERROR.ACCOUNT_EXISTS);
        }
        throw error;
      }
    }

    if (params.flow === "signIn") {
      if (password.length === 0) {
        throw new ConvexError(AUTH_ERROR.WRONG_PASSWORD);
      }
      try {
        const { user } = await retrieveAccount(ctx, {
          provider: PASSWORD_PROVIDER_ID,
          account: { id: email, secret: password },
        });
        return { userId: user._id };
      } catch (error) {
        const text = errorText(error);
        if (text.includes("InvalidAccountId")) {
          throw new ConvexError(AUTH_ERROR.NO_ACCOUNT);
        }
        if (text.includes("InvalidSecret")) {
          throw new ConvexError(AUTH_ERROR.WRONG_PASSWORD);
        }
        if (text.includes("TooManyFailedAttempts")) {
          throw new ConvexError(AUTH_ERROR.TOO_MANY_ATTEMPTS);
        }
        throw error;
      }
    }

    // Password reset and email verification need an email provider, which
    // isn't approved yet.
    throw new Error(`Unsupported auth flow: ${stringParam(params.flow)}`);
  },
  crypto: {
    async hashSecret(password: string) {
      return await new Scrypt().hash(password);
    },
    async verifySecret(password: string, hash: string) {
      return await new Scrypt().verify(hash, password);
    },
  },
});
