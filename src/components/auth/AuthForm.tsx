"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { AUTH_ERROR, toAuthFormError, type AuthFormError } from "@/lib/authErrors";
import {
  confirmPasswordError,
  validateAuthForm,
  type FieldErrors,
  type Mode,
} from "@/lib/authForm";
import { AFTER_AUTH_PATH, SIGN_IN_PATH, SIGN_UP_PATH } from "@/lib/routes";
import { PasswordInput } from "./PasswordInput";

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-base text-foreground " +
  "aria-[invalid=true]:border-danger";

function FieldError({ id, error }: { id: string; error?: AuthFormError }) {
  if (error === undefined) return null;
  return (
    <p id={id} className="mt-1 text-sm text-danger">
      {error.message}
    </p>
  );
}

export function AuthForm({ mode }: { mode: Mode }) {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  // The mismatch message waits until the confirm field is left or the form is
  // submitted, so it doesn't flash while someone is still typing.
  const [showMismatch, setShowMismatch] = useState(false);
  // State updates are async, so a fast double click could slip past the
  // disabled button. The ref closes that gap.
  const inFlight = useRef(false);

  const isSignUp = mode === "signUp";
  const mismatch = isSignUp ? confirmPasswordError(password, confirmation) : null;
  const confirmError = showMismatch ? mismatch : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;

    const form = new FormData(event.currentTarget);
    const values = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    };
    const clientErrors = validateAuthForm(mode, values);
    setErrors(clientErrors);
    if (isSignUp) setShowMismatch(true);
    if (Object.keys(clientErrors).length > 0 || mismatch !== null) return;

    inFlight.current = true;
    setSubmitting(true);
    form.set("flow", mode);
    if (isSignUp) form.set("timezone", browserTimezone());
    try {
      await signIn("password", form);
      router.push(AFTER_AUTH_PATH);
      // Keep the button disabled while navigating away.
    } catch (error) {
      const formError = toAuthFormError(error);
      setErrors({ [formError.field]: formError });
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  const formError = errors.form;

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-5" aria-busy={submitting}>
      {formError !== undefined && (
        <div
          role="alert"
          className="rounded-md border border-danger bg-danger-surface px-3 py-2 text-sm text-danger"
        >
          <p>{formError.message}</p>
          {formError.code === AUTH_ERROR.NO_ACCOUNT && (
            <p className="mt-1">
              <Link href={SIGN_UP_PATH} className="font-medium underline">
                Create an account instead
              </Link>
            </p>
          )}
          {formError.code === AUTH_ERROR.ACCOUNT_EXISTS && (
            <p className="mt-1">
              <Link href={SIGN_IN_PATH} className="font-medium underline">
                Sign in instead
              </Link>
            </p>
          )}
        </div>
      )}

      {isSignUp && (
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            className={inputClass}
            aria-invalid={errors.name !== undefined}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
          <FieldError id="name-error" error={errors.name} />
        </div>
      )}

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className={inputClass}
          aria-invalid={errors.email !== undefined}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
        <FieldError id="email-error" error={errors.email} />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Password
        </label>
        <PasswordInput
          id="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={isSignUp ? "new-password" : "current-password"}
          className={inputClass}
          aria-invalid={errors.password !== undefined}
          aria-describedby={
            [errors.password ? "password-error" : null, isSignUp ? "password-hint" : null]
              .filter(Boolean)
              .join(" ") || undefined
          }
        />
        {isSignUp && (
          <p id="password-hint" className="mt-1 text-sm text-muted">
            At least 8 characters, with a letter and a number.
          </p>
        )}
        <FieldError id="password-error" error={errors.password} />
      </div>

      {isSignUp && (
        <div>
          <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium">
            Confirm password
          </label>
          {/* No name attribute: the confirmation is left out of the form data
              sent to the server. */}
          <PasswordInput
            id="confirm-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            onBlur={(e) => {
              // Tapping this field's own eye button isn't "leaving" it.
              if (e.relatedTarget?.getAttribute("aria-controls") === "confirm-password") return;
              setShowMismatch(true);
            }}
            autoComplete="new-password"
            className={inputClass}
            aria-invalid={confirmError !== null}
            aria-describedby={confirmError !== null ? "confirm-password-error" : undefined}
          />
          {confirmError !== null && (
            <p id="confirm-password-error" className="mt-1 text-sm text-danger">
              {confirmError}
            </p>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || mismatch !== null}
        className="w-full rounded-md bg-accent px-4 py-2 font-medium text-accent-foreground disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting
          ? isSignUp
            ? "Creating account…"
            : "Signing in…"
          : isSignUp
            ? "Create account"
            : "Sign in"}
      </button>

      <p className="text-center text-sm text-muted">
        {isSignUp ? (
          <>
            Already have an account?{" "}
            <Link href={SIGN_IN_PATH} className="font-medium text-foreground underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href={SIGN_UP_PATH} className="font-medium text-foreground underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
