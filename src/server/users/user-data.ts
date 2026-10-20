import { isArrayOf, isRecord, isSavedRoutesBatch, isTrackedBet } from '@/lib/runtime-validation';
import { SYNCED_KEYS, type SyncedKey } from '@/lib/user-data-keys';
import { HttpError, withAuth } from '@/server/shared/http';
import { saveUserData as upsertUserData, userDataFor } from '@/server/users/queries';

/** Portfolio history tops out near 200 KB; this leaves room without inviting abuse. */
const MAX_VALUE_BYTES = 1_000_000;

/**
 * Shape checks per key. Loose on purpose for the blobs the client sanitizes on
 * read (preferences, onboarding profile, history envelope): the server only has
 * to refuse garbage, not know every field.
 */
const VALIDATORS: Record<SyncedKey, (value: unknown) => boolean> = {
  bets: isArrayOf(isTrackedBet),
  savedRoutes: isArrayOf(isSavedRoutesBatch),
  preferences: isRecord,
  onboardingProfile: isRecord,
  portfolioProgress: (value) => isRecord(value) && Array.isArray(value.points),
};

function isSyncedKey(value: unknown): value is SyncedKey {
  return typeof value === 'string' && (SYNCED_KEYS as readonly string[]).includes(value);
}

/** Every synced blob this account has, as `{ values: { [key]: value } }`. */
export const getUserData = withAuth('user-data', async (_request, userId) => {
  const rows = await userDataFor(userId);
  const values = Object.fromEntries(rows.filter((row) => isSyncedKey(row.key)).map((row) => [row.key, row.value]));
  return Response.json({ values });
});

/** Replaces one blob: `{ key, value }`. Last write wins. */
export const saveUserData = withAuth('user-data', async (request, userId) => {
  const text = await request.text();
  if (text.length > MAX_VALUE_BYTES) throw new HttpError(413, 'Too large');

  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    // falls through to the shape check
  }
  if (!isRecord(body) || !isSyncedKey(body.key) || !VALIDATORS[body.key](body.value)) {
    throw new HttpError(400, 'Invalid body');
  }

  await upsertUserData(userId, body.key, body.value);
  return Response.json({ ok: true });
});
