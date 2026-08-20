/**
 * TEMPORARY diagnostic. Reports only the *shape* of server env vars — never a value —
 * so we can confirm which Clerk instance the deployed Worker verifies against.
 * Delete this file once the production Clerk cutover is confirmed.
 */
function classify(value: string | undefined): string {
  if (value === undefined) return 'undefined';
  if (value === '') return 'empty';
  if (value.startsWith('sk_test_')) return 'sk_test_ (DEV instance)';
  if (value.startsWith('sk_live_')) return 'sk_live_ (PROD instance)';
  return `other (${value.length} chars)`;
}

export function GET(): Response {
  return Response.json({
    clerkSecretKey: classify(process.env.CLERK_SECRET_KEY),
    clerkPublishableKey: (process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? 'undefined').slice(0, 16),
    neonDatabaseUrlDefined: Boolean(process.env.NEON_DATABASE_URL),
  });
}
