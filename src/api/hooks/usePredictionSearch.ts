import { useMarketSearch } from '@/api/hooks/useMarketSearch';
import { MIN_KEYWORD_LENGTH } from '@/lib/search-routes';
import type { RouteParams } from '@/types/routes';

export { useDebounced } from '@/api/hooks/useMarketSearch';
export { MIN_KEYWORD_LENGTH } from '@/lib/search-routes';

/**
 * Markets matching a typed keyword, turned into routes priced against the current
 * goal. Reaches past the goal-scoped pool: asking for "Messi" means Messi markets,
 * including ones the goal filter would never have surfaced. The odds still tell the
 * truth about whether they get the user there.
 */
export function usePredictionSearch(keyword: string, params: RouteParams | null) {
  const { results, settled, enabled, isSearching, error } = useMarketSearch(keyword, params);
  return {
    routes: results.prediction,
    /** True while a search the user can see is still resolving. */
    isSearching,
    /** The keyword the current results belong to, for "no matches" messaging. */
    searchedKeyword: enabled ? settled : '',
    /** Set when the typed keyword hasn't been searched yet (too short). */
    isTooShort: keyword.trim().length > 0 && keyword.trim().length < MIN_KEYWORD_LENGTH,
    error,
  };
}
