import { searchPolymarketByKeyword } from '@/api/client/polymarket-market-data';
import { matchAssetSymbols } from '@/lib/asset-search';
import type { PoolGoal } from '@/lib/route-pool';
import { assetSearchRoutes, predictionSearchRoutes, type SearchResults } from '@/lib/search-routes';
import { cachedMarketSnapshot } from '@/server/market/snapshot';
import { memoized } from '@/server/memo';

/** A keyword's markets barely move in five minutes; popular searches cost one lookup. */
const SEARCH_TTL_MS = 5 * 60_000;

export async function searchRoutes(keyword: string, goal: PoolGoal): Promise<SearchResults> {
  const normalized = keyword.trim().toLowerCase();
  const symbols = matchAssetSymbols(normalized);
  const [markets, snapshot] = await Promise.all([
    memoized(`search:${normalized}`, SEARCH_TTL_MS, () => searchPolymarketByKeyword(normalized)),
    // Every symbol search can resolve to is already in the shared snapshot: no new quotes.
    symbols.length > 0 ? cachedMarketSnapshot() : Promise.resolve(null),
  ]);
  const quotes = (snapshot?.value.context.stocks ?? []).filter((quote) => symbols.includes(quote.symbol));
  return {
    prediction: predictionSearchRoutes(markets, goal),
    assets: assetSearchRoutes(quotes, goal),
    matchedSymbols: symbols,
  };
}
