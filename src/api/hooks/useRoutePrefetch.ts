import { useEffect, useRef } from 'react';

import { fetchStocks, fetchTreasuryBillYields } from '@/api/client/market-quotes';
import { fetchPolymarketPickBundle } from '@/api/client/polymarket-picks';
import { fetchPolymarketSnapshot } from '@/api/client/polymarket-market-data';

/**
 * Warms the market data a route search needs, while the user is still answering.
 *
 * The first search after the survey used to start from nothing: every quote, the
 * Polymarket snapshot and the pick bundle were fetched only once the user asked
 * for routes, and they watched all of it behind a progress bar. None of that work
 * depends on a single answer they give — prices are prices — so it can happen
 * minutes earlier, during pages they are reading anyway.
 *
 * Deliberately warms DATA rather than pre-running the search itself. The pool is
 * cached per goal (`dailyGoalKey`), and the goal's dollar target is not known
 * until goal-setup, two screens later — so a speculative search would be keyed
 * on a guess and thrown away whenever the guess was wrong. Everything warmed here
 * is target-independent and therefore never wasted.
 *
 * Fire-and-forget by design: each fetch populates its own module cache, and this
 * hook never reports success, blocks, or retries. If the network is down the
 * search behaves exactly as it did before.
 */
export function useRoutePrefetch(active: boolean): void {
  const started = useRef(false);

  useEffect(() => {
    if (!active || started.current) return;
    started.current = true;
    console.log('[prefetch] warming market data during the survey');
    // Not Promise.all: these are independent, and one failing must not cancel the
    // others' caches. Every rejection is swallowed — a warm-up that fails is a
    // search that runs at its old speed, never an error the user sees.
    void fetchPolymarketSnapshot().catch(() => undefined);
    void fetchStocks().catch(() => undefined);
    void fetchTreasuryBillYields().catch(() => undefined);
    void fetchPolymarketPickBundle().catch(() => undefined);
  }, [active]);
}
