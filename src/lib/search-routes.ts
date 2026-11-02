import type { PolymarketEntry, StockQuote } from '@/api/client/market-data-types';
import { timeframeCalendarDays } from '@/api/client/playbook';
import { buildCryptoRoutes } from '@/lib/crypto-routes';
import { buildEtfRoutes } from '@/lib/etf-routes';
import { buildPolymarketRoutes } from '@/lib/polymarket-routes';
import type { PoolGoal } from '@/lib/route-pool';
import type { Route } from '@/types/routes';

/**
 * Routes for a typed keyword, priced against the current goal. Pure, so the server and
 * the device's fallback build them the same way.
 *
 * Deliberately reaches past the goal-scoped pool: asking for "Messi" means Messi
 * markets, and naming a fund surfaces it, even when the goal filter would never have.
 */

/** Below this, a keyword matches half of Polymarket and the request is wasted. */
export const MIN_KEYWORD_LENGTH = 2;

/** Ceiling on markets turned into routes from one search, before the band quotas. */
const MAX_SEARCH_MARKETS = 150;

export interface SearchResults {
  prediction: Route[];
  assets: Route[];
  /** Symbols the keyword resolved to — empty means we cover nothing by that name. */
  matchedSymbols: string[];
}

export const NO_RESULTS: SearchResults = { prediction: [], assets: [], matchedSymbols: [] };

export function predictionSearchRoutes(markets: PolymarketEntry[], goal: PoolGoal): Route[] {
  if (markets.length === 0) return [];
  // A tournament query ("us open") reaches several hundred markets, and each one can
  // yield two routes. Cap it: buildPolymarketRoutes fills its quota across price bands,
  // so the cut keeps longshots and favourites both represented rather than lopping off
  // whichever end sorted last.
  return buildPolymarketRoutes(markets, goal, Math.min(markets.length, MAX_SEARCH_MARKETS));
}

export function assetSearchRoutes(quotes: StockQuote[], goal: PoolGoal): Route[] {
  if (quotes.length === 0) return [];
  const build = {
    quotes,
    balance: goal.balance,
    target: goal.target,
    deadlineDays: timeframeCalendarDays(goal.timeframe),
  };
  // Both builders filter to their own universe, so a symbol only ever produces the one
  // route that belongs to it.
  return [...buildEtfRoutes(build), ...buildCryptoRoutes(build)];
}
