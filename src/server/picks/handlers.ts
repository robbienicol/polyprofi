import { crawlPolymarketPickBundle } from '@/api/client/polymarket-picks';
import { cached } from '@/server/shared/cache';

// One shared row, refreshed at most this often. The crawl behind it is the same
// for every user at a given moment (no personalization reaches it), so a day-old
// answer is as good as a fresh one for anyone but the first request after it goes
// stale — that request pays the ~5s crawl once, everyone else reads the cache.
const CACHE_KEY = 'default';
const TTL_MS = 24 * 60 * 60 * 1000;

/** Unauthenticated on purpose: the bundle is the same for everyone. */
export async function getPolymarketPicks(): Promise<Response> {
  // A failed refresh is still better served from yesterday's cache than as an
  // error — the crawl route's own callers already fall back to an empty bundle
  // on any non-2xx response, so a stale bundle beats that too.
  const result = await cached(CACHE_KEY, crawlPolymarketPickBundle, { ttlMs: TTL_MS });
  if (result) return Response.json(result.value);
  return Response.json({ error: 'Failed to fetch picks' }, { status: 502 });
}
