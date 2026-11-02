/**
 * Device blobs mirrored to the `user_data` table. Shared by the API route and
 * the client sync so neither can accept a key the other doesn't know.
 *
 * Deliberately absent: spending cuts (the privacy policy promises they never
 * leave the device), the alert ledger (device-local by design), quiz answers
 * and early access / onboarding / biometric flags (per device), and caches.
 */
export const SYNCED_KEYS = [
  'bets',
  'savedRoutes',
  'preferences',
  'onboardingProfile',
  'portfolioProgress',
] as const;

export type SyncedKey = (typeof SYNCED_KEYS)[number];
