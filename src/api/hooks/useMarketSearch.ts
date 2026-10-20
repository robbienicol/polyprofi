import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { searchMarkets } from '@/api/client/market-search';
import { MIN_KEYWORD_LENGTH, NO_RESULTS } from '@/lib/search-routes';
import type { RouteParams } from '@/types/routes';

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
 * One search request per settled keyword, shared by the prediction and asset hooks
 * through React Query's cache — they read different halves of the same answer.
 */
export function useMarketSearch(keyword: string, params: RouteParams | null) {
  const { getToken } = useAuth();
  const settled = useDebounced(keyword.trim());
  const enabled = settled.length >= MIN_KEYWORD_LENGTH && params !== null;

  const query = useQuery({
    // Params belong in the key: the same keyword priced for a different goal is a
    // different answer, since stake sizing and expected return both move with it.
    queryKey: ['MARKET_SEARCH', settled.toLowerCase(), params?.balance ?? 0, params?.target ?? 0, params?.timeframe ?? ''],
    queryFn: () => (params ? searchMarkets(settled, params, getToken) : Promise.resolve(NO_RESULTS)),
    enabled,
    staleTime: 5 * 60_000,
  });

  return {
    results: query.data ?? NO_RESULTS,
    settled,
    enabled,
    isSearching: enabled && query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
  };
}
