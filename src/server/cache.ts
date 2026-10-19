import { sql } from '@/server/db';

/**
 * Shared, database-backed cache for anything that is the same for every user: market
 * data, option chains, the AI slate. One fetch serves everyone until it goes stale.
 *
 * Rows live in `polymarket_pick_cache` (key → JSONB, fetched_at) — the table predates
 * the name it now deserves, and every cached thing gets its own key.
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

interface CacheRow {
  bundle: unknown;
  fetched_at: string;
}

const inflight = new Map<string, Promise<unknown>>();

export async function readCache<T>(key: string): Promise<{ value: T; fetchedAt: string } | null> {
  const rows = (await sql`
    SELECT bundle, fetched_at FROM polymarket_pick_cache WHERE key = ${key}
  `) as CacheRow[];
  const row = rows[0];
  return row ? { value: row.bundle as T, fetchedAt: row.fetched_at } : null;
}

export async function writeCache(key: string, value: unknown): Promise<void> {
  await sql`
    INSERT INTO polymarket_pick_cache (key, bundle, fetched_at)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET bundle = EXCLUDED.bundle, fetched_at = EXCLUDED.fetched_at
  `;
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
