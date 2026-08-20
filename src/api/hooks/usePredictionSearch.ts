import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { searchPolymarketByKeyword } from '@/api/client/polymarket-market-data';
import { buildPolymarketRoutes } from '@/lib/polymarket-routes';
import type { Route, RouteParams } from '@/types/routes';

/** Below this, a keyword matches half of Polymarket and the request is wasted. */
export const MIN_KEYWORD_LENGTH = 2;

/** Keystrokes settle before a request goes out, so typing "Messi" is one search. */
const DEBOUNCE_MS = 350;

export function useDebounced<T>(value: T, delayMs = DEBOUNCE_MS): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

/**
 * Markets matching a typed keyword, turned into routes priced against the current
 * goal. This deliberately reaches past the goal-scoped pool: asking for "Messi"
 * means Messi markets, including ones the goal filter would never have surfaced.
 * The score still tells the truth about whether they get the user there.
 */
export function usePredictionSearch(keyword: string, params: RouteParams | null) {
  const settled = useDebounced(keyword.trim());
  const enabled = settled.length >= MIN_KEYWORD_LENGTH && params !== null;

  const { data, isFetching, error } = useQuery({
    // Params belong in the key: the same keyword priced for a different goal is a
    // different answer, since stake sizing and expected return both move with it.
    queryKey: ['PREDICTION_SEARCH', settled.toLowerCase(), params?.balance ?? 0, params?.target ?? 0, params?.timeframe ?? ''],
    queryFn: async (): Promise<Route[]> => {
      const markets = await searchPolymarketByKeyword(settled);
      if (markets.length === 0 || !params) return [];
      return buildPolymarketRoutes(markets, params, markets.length);
    },
    enabled,
    staleTime: 5 * 60_000,
  });

  return {
    routes: data ?? [],
    /** True while a search the user can see is still resolving. */
    isSearching: enabled && isFetching,
    /** The keyword the current results belong to, for "no matches" messaging. */
    searchedKeyword: enabled ? settled : '',
    /** Set when the typed keyword hasn't been searched yet (too short). */
    isTooShort: keyword.trim().length > 0 && keyword.trim().length < MIN_KEYWORD_LENGTH,
    error: error instanceof Error ? error.message : null,
  };
}
