import { fetchMarketContext, type MarketContext, type PolymarketEntry } from '@/api/client/market-data';
import { fetchPolymarketSnapshot } from '@/api/client/polymarket-market-data';
import { cached } from '@/server/cache';

/**
 * Every piece of public market data a search needs, fetched once and shared by every
 * user: Polymarket (about 6 requests), 39 Yahoo quotes with five years of history each,
 * the Treasury curve, the SGOV page and Metaculus. On the device that was ~45 requests
 * and megabytes of history per search, per phone. Here it is one cached row.
 *
 * Ten minutes, matching the quote cache underneath it: prices move, but nothing on a
 * route card is precise enough for a fresher number to change it.
 */
export interface MarketSnapshot {
  context: MarketContext;
  /** Binary markets balanced across maturities — what the Polymarket routes are built from. */
  universe: PolymarketEntry[];
}

const KEY = 'market-snapshot-v1';
const TTL_MS = 10 * 60 * 1000;

async function fetchMarketSnapshot(): Promise<MarketSnapshot> {
  const polymarket = await fetchPolymarketSnapshot(240, { fresh: true }).catch(() => ({ context: [], universe: [] }));
  const context = await fetchMarketContext({ polymarket: Promise.resolve(polymarket.context) });
  return { context, universe: polymarket.universe };
}

export function cachedMarketSnapshot() {
  return cached(KEY, fetchMarketSnapshot, {
    ttlMs: TTL_MS,
    // Without Polymarket or quotes the pool would be half a pool; keep the last full one.
    isEmpty: (snapshot) => snapshot.universe.length === 0 || snapshot.context.stocks.length === 0,
  });
}
