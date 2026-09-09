/**
 * One-tap sign-in for local development, so you don't retype credentials (or
 * re-sign-up) on every fresh install.
 *
 * Set both in `.env` to switch it on:
 *   EXPO_PUBLIC_DEV_LOGIN_EMAIL=dev@example.com
 *   EXPO_PUBLIC_DEV_LOGIN_PASSWORD=some-throwaway-password
 *
 * Gated on `__DEV__`, so the button never renders in a release build. Note that
 * `EXPO_PUBLIC_*` values are inlined into the JS bundle at build time, so this
 * must be a throwaway account — never a real one.
 */
export const DEV_LOGIN: { email: string; password: string } | null = (() => {
  if (!__DEV__) return null;
  const email = process.env.EXPO_PUBLIC_DEV_LOGIN_EMAIL?.trim().toLowerCase();
  const password = process.env.EXPO_PUBLIC_DEV_LOGIN_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
})();
