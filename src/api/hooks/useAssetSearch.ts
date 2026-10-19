import { useMarketSearch } from '@/api/hooks/useMarketSearch';
import { matchAssetSymbols } from '@/lib/asset-search';
import type { RouteParams } from '@/types/routes';

/**
 * Funds, stocks and coins matching a typed keyword, priced against the current goal.
 *
 * The counterpart to usePredictionSearch for the asset side of the map. It exists
 * because the goal-scoped pool has already dropped most of the universe: a defensive
 * quiz never sees a coin, and a $200 one-week goal drops every bond fund as an
 * unreachable near-miss. Naming one should still surface it — priced honestly.
 *
 * Only symbols we curate resolve. An asset outside the universes returns nothing, and
 * the caller says so out loud rather than showing an empty list.
 */
export function useAssetSearch(keyword: string, params: RouteParams | null) {
  const { results, settled, isSearching, error } = useMarketSearch(keyword, params);
  // Matched locally, on the settled keyword: known before the request returns.
  const matchedSymbols = matchAssetSymbols(settled);
  return {
    routes: results.assets,
    /** True while a lookup the user can see is still resolving. */
    isSearching: isSearching && matchedSymbols.length > 0,
    /** Symbols the typed words resolved to — empty means we cover nothing by that name. */
    matchedSymbols,
    error,
  };
}
