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
