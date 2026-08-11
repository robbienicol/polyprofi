/**
 * Clerk throws errors shaped `{ errors: [{ code, message, longMessage }] }`, and
 * network failures throw plain `TypeError: Network request failed`. Both used to
 * surface raw to the user; this maps them to something actionable.
 */
export function clerkErrorMessage(
  e: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  const first = (e as { errors?: { code?: string; message?: string; longMessage?: string }[] })
    ?.errors?.[0];

  switch (first?.code) {
    case 'form_identifier_not_found':
    case 'form_password_incorrect':
    case 'strategy_for_user_invalid':
      return 'That email and password don’t match an account.';
    case 'form_identifier_exists':
      return 'You already have an account with that email. Sign in instead.';
    case 'form_password_pwned':
      return 'That password has shown up in a data breach. Pick a different one.';
    case 'form_password_length_too_short':
      return 'Use at least 8 characters.';
    case 'form_code_incorrect':
    case 'verification_failed':
      return 'That code isn’t right. Check it or send a new one.';
    case 'verification_expired':
      return 'That code expired. Send a new one.';
    case 'too_many_requests':
      return 'Too many tries. Wait a minute and try again.';
    default:
      break;
  }

  if (first?.longMessage || first?.message) return first.longMessage ?? first.message!;

  const raw = e instanceof Error ? e.message : '';
  if (/network request failed|failed to fetch|timeout|internet/i.test(raw)) {
    return 'Can’t reach the server. Check your connection and try again.';
  }
  return raw || fallback;
}
