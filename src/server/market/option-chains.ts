import { fetchChains } from '@/api/client/options-chain-fetch';
import type { OptionChain } from '@/api/client/options-chain-types';
import { cached } from '@/server/cache';

/**
 * Live option chains for the options routes, trimmed server-side.
 *
 * CBOE's delayed-quotes feed is free and needs no key, but it sends no CORS headers and
 * each file is 2–6 MB, so the device can't fetch it directly and shouldn't try. This
 * pulls the universe once, keeps only the expiries and contracts the route builder can
 * use, and caches the result. Quotes are ~15 minutes delayed at source, so a 15-minute
 * cache adds no staleness anyone could trade on.
 */
const KEY = 'options-chains-v2';
const TTL_MS = 15 * 60 * 1000;

export function cachedOptionChains() {
  return cached<{ chains: OptionChain[] }>(
    KEY,
    async () => ({ chains: await fetchChains() }),
    { ttlMs: TTL_MS, isEmpty: (value) => value.chains.length === 0 },
  );
}
