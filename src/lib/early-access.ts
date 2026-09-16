/**
 * Early-access gate for the invite-only period.
 *
 * The code is a shared secret, not a credential: it keeps the door closed to
 * anyone who has not been handed it, and nothing more. Comparison is trimmed and
 * case-insensitive because it is read off a screenshot or a DM as often as it is
 * typed, and a rejected paste of the right code is a support ticket for nothing.
 */
export const EARLY_ACCESS_CODE = 'thankyou';

export function isValidEarlyAccessCode(input: string): boolean {
  return input.trim().toLowerCase() === EARLY_ACCESS_CODE;
}

/**
 * Accounts handed to App Review and TestFlight testers skip the invite wall
 * outright. The code is in the review notes either way, but a tester who
 * mistypes it or never reads the notes is a failed review over nothing, so the
 * door recognises its own keys. Scoped to a domain we own rather than a list of
 * addresses: nobody outside the team can mint one, and adding a tester is one
 * mailbox, not a release.
 */
const TESTER_EMAIL_DOMAINS: readonly string[] = ['usepathey.com'];

export function isTesterEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const at = email.lastIndexOf('@');
  if (at < 0) return false;
  return TESTER_EMAIL_DOMAINS.includes(email.slice(at + 1).trim().toLowerCase());
}
