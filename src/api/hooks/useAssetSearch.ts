import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { timeframeCalendarDays } from '@/api/client/playbook';
import { fetchStockQuotes } from '@/api/client/market-quotes';
import { useDebounced } from '@/api/hooks/usePredictionSearch';
import { matchAssetSymbols } from '@/lib/asset-search';
import { buildCryptoRoutes } from '@/lib/crypto-routes';
import { buildEtfRoutes } from '@/lib/etf-routes';
import type { Route, RouteParams } from '@/types/routes';

/**
 * Funds, stocks and coins matching a typed keyword, priced against the current goal.
 *
 * The counterpart to usePredictionSearch for the asset side of the map. It exists
 * because the goal-scoped pool has already dropped most of the universe: a defensive
 * quiz never sees a coin, and a $200 one-week goal drops every bond fund as an
 * unreachable near-miss. Naming one should still surface it — priced honestly, with
 * the score free to say it does not get the user there.
 *
 * Only symbols we curate resolve. An asset outside the universes returns nothing, and
 * the caller says so out loud rather than showing an empty list.
 */
export function useAssetSearch(keyword: string, params: RouteParams | null) {
  const settled = useDebounced(keyword.trim());
  const symbols = useMemo(() => matchAssetSymbols(settled), [settled]);
  const symbolKey = symbols.join(',');
  const enabled = symbols.length > 0 && params !== null;

  const { data, isFetching, error } = useQuery({
    // Params belong in the key for the same reason they do in the prediction search:
    // the same fund priced for a different goal is a different answer.
    queryKey: ['ASSET_SEARCH', symbolKey, params?.balance ?? 0, params?.target ?? 0, params?.timeframe ?? ''],
    queryFn: async (): Promise<Route[]> => {
      if (!params) return [];
      const quotes = await fetchStockQuotes(symbols);
      if (quotes.length === 0) return [];
      const build = {
        quotes,
        balance: params.balance,
        target: params.target,
        deadlineDays: timeframeCalendarDays(params.timeframe),
      };
      // Both builders filter to their own universe, so a symbol only ever produces
      // the one route that belongs to it.
      return [...buildEtfRoutes(build), ...buildCryptoRoutes(build)];
    },
    enabled,
    staleTime: 5 * 60_000,
  });

  return {
    routes: data ?? [],
    /** True while a lookup the user can see is still resolving. */
    isSearching: enabled && isFetching,
    /** Symbols the typed words resolved to — empty means we cover nothing by that name. */
    matchedSymbols: symbols,
    error: error instanceof Error ? error.message : null,
  };
}
