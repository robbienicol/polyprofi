/**
 * Clerk error handling + identifier normalization for the auth screens.
 *
 * Two problems this solves:
 *
 * 1. Clerk throws `ClerkAPIResponseError`, whose `.message` is a terse summary
 *    ("Unable to complete action"). The useful text lives in `errors[0]`, so
 *    reading `e.message` shows users nothing actionable. Always go through
 *    `describeAuthError`.
 * 2. iOS QuickType/autofill happily hands us `" Rob@Example.com "`. Clerk does
 *    not trim identifiers, so the lookup misses and the user is told their email
 *    doesn't exist — while looking at the email that plainly does. Every
 *    identifier must go through `normalizeEmail` before it reaches Clerk.
 */

type ClerkErrorEntry = {
  code?: string;
  message?: string;
  longMessage?: string;
};

type ClerkErrorLike = {
  errors?: ClerkErrorEntry[];
  message?: string;
};

/**
 * Friendlier copy for the codes users actually hit. Anything not listed falls
 * back to Clerk's own `longMessage`, which is already user-facing.
 */
const MESSAGE_BY_CODE: Record<string, string> = {
  form_identifier_not_found:
    "We couldn't find an account with that email. Double-check it, or create a new account.",
  form_password_incorrect:
    "That password isn't right. Try again, or reset it with “Forgot password?”.",
  form_param_format_invalid: 'That email address looks incomplete. Check it and try again.',
  form_param_nil: 'Please fill in every field.',
  form_identifier_exists:
    'An account already exists for that email. Sign in instead, or reset your password.',
  form_code_incorrect: "That code isn't right. Check the latest email and try again.",
  verification_expired: 'That code expired. Request a new one and try again.',
  verification_failed: 'Too many incorrect attempts. Request a new code to start over.',
  form_password_pwned:
    'That password has appeared in a public data breach. Please choose a different one.',
  form_password_length_too_short: 'Passwords need to be at least 8 characters.',
  form_password_not_strong_enough:
    'That password is too weak. Add more length or mix in numbers and symbols.',
  session_exists: "You're already signed in on this device.",
  too_many_requests: 'Too many attempts. Wait a minute and try again.',
  strategy_for_user_invalid:
    'That account signs in a different way (for example a social login), so it has no password to reset.',
};

function toClerkError(e: unknown): ClerkErrorLike | null {
  return typeof e === 'object' && e !== null ? (e as ClerkErrorLike) : null;
}

/** Every Clerk error code present on a thrown error, in order. */
export function clerkErrorCodes(e: unknown): string[] {
  const entries = toClerkError(e)?.errors;
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => entry?.code).filter((code): code is string => !!code);
}

/** True when the thrown error carries any of `codes`. */
export function hasClerkErrorCode(e: unknown, ...codes: string[]): boolean {
  const present = clerkErrorCodes(e);
  return codes.some((code) => present.includes(code));
}

/**
 * Turn anything thrown by Clerk into a single sentence worth showing a user.
 * Prefers our own copy, then Clerk's `longMessage`, then `message`.
 */
export function describeAuthError(e: unknown, fallback: string): string {
  const clerkError = toClerkError(e);
  const first = clerkError?.errors?.[0];

  for (const code of clerkErrorCodes(e)) {
    const mapped = MESSAGE_BY_CODE[code];
    if (mapped) return mapped;
  }

  return first?.longMessage ?? first?.message ?? clerkError?.message ?? fallback;
}

/**
 * Strip whitespace (JS `\s` covers non-breaking spaces and BOM, which iOS
 * autofill can inject) and lower-case, so the identifier we send matches what
 * Clerk stored. Clerk lower-cases email addresses on its side.
 */
export function normalizeEmail(raw: string): string {
  return raw.replace(/\s/g, '').toLowerCase();
}

/**
 * A sign-in/sign-up `status` we don't have a UI branch for. Surfacing the raw
 * status beats leaving the button spinning with no feedback, and it tells us
 * what to build next when it shows up in a TestFlight report.
 */
export function describeUnhandledStatus(status: string | null): string {
  switch (status) {
    case 'needs_second_factor':
      return 'This account has two-factor authentication enabled, which this app version cannot complete yet. Turn 2FA off, or contact support.';
    case 'needs_first_factor':
      return 'This account needs a different sign-in method than a password. Try “Forgot password?” to set one.';
    case 'needs_identifier':
      return 'Please enter your email address.';
    case 'missing_requirements':
      return 'Your account needs more information before it can be created. Please contact support.';
    case 'abandoned':
      return 'This sign-up expired. Please start again.';
    default:
      return `Sign in could not be completed (status: ${status ?? 'unknown'}). Please contact support.`;
  }
}
