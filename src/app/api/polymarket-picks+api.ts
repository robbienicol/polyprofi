import { neon } from '@neondatabase/serverless';

import { crawlPolymarketPickBundle } from '@/api/client/polymarket-picks';
import type { PolymarketPickBundle } from '@/api/client/polymarket-pick-types';

const sql = neon(process.env.NEON_DATABASE_URL!);

// One shared row, refreshed at most this often. The crawl behind it is the same
// for every user at a given moment (no personalization reaches it), so a day-old
// answer is as good as a fresh one for anyone but the first request after it goes
// stale — that request pays the ~5s crawl once, everyone else reads the cache.
const CACHE_KEY = 'default';
const TTL_MS = 24 * 60 * 60 * 1000;

interface CacheRow {
  bundle: PolymarketPickBundle;
  fetched_at: string;
}

export async function GET(): Promise<Response> {
  const rows = await sql`
    SELECT bundle, fetched_at FROM polymarket_pick_cache WHERE key = ${CACHE_KEY}
  ` as CacheRow[];
  const cached = rows[0];
  const isFresh = cached != null && Date.now() - new Date(cached.fetched_at).getTime() < TTL_MS;
  if (isFresh) return Response.json(cached.bundle);

  try {
    const bundle = await crawlPolymarketPickBundle();
    const serialized = JSON.stringify(bundle);
    await sql`
      INSERT INTO polymarket_pick_cache (key, bundle, fetched_at)
      VALUES (${CACHE_KEY}, ${serialized}::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET bundle = EXCLUDED.bundle, fetched_at = EXCLUDED.fetched_at
    `;
    return Response.json(bundle);
  } catch (error) {
    console.warn(`[api:polymarket-picks] ${error instanceof Error ? error.message : String(error)}`);
    // A failed refresh is still better served from yesterday's cache than as an
    // error — the crawl route's own callers already fall back to an empty bundle
    // on any non-2xx response, so a stale bundle beats that too.
    if (cached) return Response.json(cached.bundle);
    return Response.json({ error: 'Failed to fetch picks' }, { status: 502 });
  }
}
