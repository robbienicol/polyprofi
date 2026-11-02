import { eq } from 'drizzle-orm';

import { cacheEntries, db } from '@/server/db';

/**
 * Shared, database-backed cache for anything that is the same for every user: market
 * data, option chains, the AI slate. One fetch serves everyone until it goes stale.
 *
 * Rows live in `cacheEntries` (see db/schema), one key per cached thing.
 *
 * Three rules every caller gets for free:
 * - Fresh rows are served without touching the source.
 * - Concurrent misses on one server instance share a single fetch.
 * - A failed fetch serves the last good value, flagged stale, rather than nothing.
 */

export interface Cached<T> {
  value: T;
  fetchedAt: string;
  stale: boolean;
}

interface CacheOptions<T> {
  /** How long a stored value counts as fresh. */
  ttlMs: number;
  /** Treat this result as a failure (e.g. an empty list): don't store it, serve the last good one. */
  isEmpty?: (value: T) => boolean;
}

const inflight = new Map<string, Promise<unknown>>();

export async function readCache<T>(key: string): Promise<{ value: T; fetchedAt: string } | null> {
  const [row] = await db.select().from(cacheEntries).where(eq(cacheEntries.key, key));
  return row ? { value: row.bundle as T, fetchedAt: row.fetchedAt } : null;
}

export async function writeCache(key: string, value: unknown): Promise<void> {
  const fetchedAt = new Date().toISOString();
  await db.insert(cacheEntries)
    .values({ key, bundle: value, fetchedAt })
    .onConflictDoUpdate({ target: cacheEntries.key, set: { bundle: value, fetchedAt } });
}

function ageMs(fetchedAt: string): number {
  return Date.now() - new Date(fetchedAt).getTime();
}

/**
 * The value under `key`, fetched with `produce` when missing or older than `ttlMs`.
 * Returns null only when there is nothing fresh, nothing stored, and the fetch failed.
 */
export async function cached<T>(
  key: string,
  produce: () => Promise<T>,
  { ttlMs, isEmpty }: CacheOptions<T>,
): Promise<Cached<T> | null> {
  const stored = await readCache<T>(key).catch(() => null);
  if (stored && ageMs(stored.fetchedAt) < ttlMs) return { ...stored, stale: false };

  let pending = inflight.get(key) as Promise<T> | undefined;
  if (!pending) {
    pending = produce().finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }

  try {
    const value = await pending;
    if (isEmpty?.(value)) throw new Error('empty result');
    await writeCache(key, value).catch((error: unknown) => {
      console.warn(`[cache:${key}] write failed: ${String(error)}`);
    });
    return { value, fetchedAt: new Date().toISOString(), stale: false };
  } catch (error) {
    console.warn(`[cache:${key}] refresh failed: ${error instanceof Error ? error.message : String(error)}`);
    return stored ? { ...stored, stale: true } : null;
  }
}
