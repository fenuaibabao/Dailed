// Shared by the sign-in/sign-up forms and the Convex password provider, so the
// browser and the server enforce exactly the same rules.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MAX_LENGTH = 100;

// Deliberately simple: one "@", a dot in the domain, no whitespace.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailError(email: string): string | null {
  const value = normalizeEmail(email);
  if (value.length === 0) return "Enter your email address.";
  if (value.length > 254 || !EMAIL_PATTERN.test(value)) {
    return "Enter a valid email address, like name@example.com.";
  }
  return null;
}

export function passwordError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Include at least one letter and one number.";
  }
  return null;
}

export function nameError(name: string): string | null {
  const value = name.trim();
  if (value.length === 0) return "Enter your name.";
  if (value.length > NAME_MAX_LENGTH) {
    return `Keep your name under ${NAME_MAX_LENGTH} characters.`;
  }
  return null;
}

export function isValidTimezone(timezone: string): boolean {
  if (timezone.length === 0 || timezone.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
