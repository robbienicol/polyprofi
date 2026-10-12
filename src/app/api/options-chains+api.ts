import { neon } from '@neondatabase/serverless';

import { fetchChains } from '@/api/client/options-chain-fetch';
import type { OptionChain } from '@/api/client/options-chain-types';
import { authenticatedUserId } from '@/lib/server-auth';

const sql = neon(process.env.NEON_DATABASE_URL!);

/**
 * Live option chains for the options routes, trimmed server-side.
 *
 * CBOE's delayed-quotes feed is free and needs no key, but it sends no CORS headers and
 * each file is 2–6 MB, so the device can't fetch it directly and shouldn't try. This
 * pulls the universe once, keeps only the expiries and contracts the route builder can
 * use, and caches the result in Neon. Quotes are ~15 minutes delayed at source, so a
 * 15-minute cache adds no staleness anyone could trade on.
 *
 * Reuses the polymarket_pick_cache table (key → JSONB, fetched_at) under its own key.
 */
const CACHE_KEY = 'options-chains-v2';
const TTL_MS = 15 * 60 * 1000;

interface CacheRow {
  bundle: { chains: OptionChain[] };
  fetched_at: string;
}

let inflight: Promise<OptionChain[]> | null = null;

export async function GET(request: Request): Promise<Response> {
  const userId = await authenticatedUserId(request);
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = (await sql`
    SELECT bundle, fetched_at FROM polymarket_pick_cache WHERE key = ${CACHE_KEY}
  `) as CacheRow[];
  const cached = rows[0];
  const fresh = cached != null && Date.now() - new Date(cached.fetched_at).getTime() < TTL_MS;
  if (fresh) return Response.json({ chains: cached.bundle.chains, fetchedAt: cached.fetched_at });

  inflight ??= fetchChains().finally(() => {
    inflight = null;
  });
  const chains = await inflight;
  if (chains.length > 0) {
    await sql`
      INSERT INTO polymarket_pick_cache (key, bundle, fetched_at)
      VALUES (${CACHE_KEY}, ${JSON.stringify({ chains })}::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET bundle = EXCLUDED.bundle, fetched_at = EXCLUDED.fetched_at
    `.catch((error: unknown) => console.warn(`[api:options-chains] cache write failed: ${String(error)}`));
    return Response.json({ chains, fetchedAt: new Date().toISOString() });
  }
  // Stale quotes are flagged, not hidden: the device still shows the snapshot time.
  if (cached) return Response.json({ chains: cached.bundle.chains, fetchedAt: cached.fetched_at, stale: true });
  return Response.json({ chains: [] });
}
