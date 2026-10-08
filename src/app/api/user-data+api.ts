import { neon } from '@neondatabase/serverless';

import { authenticatedUserId } from '@/lib/server-auth';
import { isArrayOf, isRecord, isSavedRoutesBatch, isTrackedBet } from '@/lib/runtime-validation';
import { SYNCED_KEYS, type SyncedKey } from '@/lib/user-data-keys';

const sql = neon(process.env.NEON_DATABASE_URL!);

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

interface UserDataRow {
  key: string;
  value: unknown;
}

/** Every synced blob this account has, as `{ values: { [key]: value } }`. */
export async function GET(request: Request): Promise<Response> {
  const userId = await authenticatedUserId(request);
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await sql`SELECT key, value FROM user_data WHERE clerk_id = ${userId}` as UserDataRow[];
  const values = Object.fromEntries(rows.filter((row) => isSyncedKey(row.key)).map((row) => [row.key, row.value]));
  return Response.json({ values });
}

/** Replaces one blob: `{ key, value }`. Last write wins. */
export async function POST(request: Request): Promise<Response> {
  const userId = await authenticatedUserId(request);
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const text = await request.text();
  if (text.length > MAX_VALUE_BYTES) return Response.json({ error: 'Too large' }, { status: 413 });

  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    // falls through to the shape check
  }
  if (!isRecord(body) || !isSyncedKey(body.key) || !VALIDATORS[body.key](body.value)) {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }

  await sql`
    INSERT INTO user_data (clerk_id, key, value, updated_at)
    VALUES (${userId}, ${body.key}, ${JSON.stringify(body.value)}::jsonb, now())
    ON CONFLICT (clerk_id, key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = EXCLUDED.updated_at
  `;
  return Response.json({ ok: true });
}
