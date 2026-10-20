import { apiRequest, type TokenProvider } from '@/api/client/api-request';
import { fetchStockQuotes } from '@/api/client/market-quotes';
import { searchPolymarketByKeyword } from '@/api/client/polymarket-market-data';
import { matchAssetSymbols } from '@/lib/asset-search';
import type { PoolGoal } from '@/lib/route-pool';
import { isRecord, isRoute, stringList } from '@/lib/runtime-validation';
import { assetSearchRoutes, predictionSearchRoutes, type SearchResults } from '@/lib/search-routes';

/**
 * Routes for a typed keyword: from our server (cached per keyword for everyone), or
 * built on the device from the public feeds when the server can't be reached.
 */

const TIMEOUT_MS = 8_000;

function resultsFrom(payload: unknown): SearchResults | null {
  if (!isRecord(payload) || !Array.isArray(payload.prediction) || !Array.isArray(payload.assets)) return null;
  return {
    prediction: payload.prediction.filter(isRoute),
    assets: payload.assets.filter(isRoute),
    matchedSymbols: stringList(payload.matchedSymbols),
  };
}

async function searchOnDevice(keyword: string, goal: PoolGoal): Promise<SearchResults> {
  const symbols = matchAssetSymbols(keyword);
  const [markets, quotes] = await Promise.all([
    searchPolymarketByKeyword(keyword),
    symbols.length > 0 ? fetchStockQuotes(symbols) : Promise.resolve([]),
  ]);
  return {
    prediction: predictionSearchRoutes(markets, goal),
    assets: assetSearchRoutes(quotes, goal),
    matchedSymbols: symbols,
  };
}

export async function searchMarkets(keyword: string, goal: PoolGoal, getToken?: TokenProvider): Promise<SearchResults> {
  const query = new URLSearchParams({
    q: keyword,
    balance: String(goal.balance),
    target: String(goal.target),
    timeframe: goal.timeframe,
  });
  const payload = await apiRequest(`/api/search?${query}`, { getToken, timeoutMs: TIMEOUT_MS });
  return resultsFrom(payload) ?? searchOnDevice(keyword, goal);
}
