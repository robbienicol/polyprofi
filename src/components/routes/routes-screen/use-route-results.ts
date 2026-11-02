import { useDeferredValue, useState } from 'react';

import { useAssetSearch } from '@/api/hooks/useAssetSearch';
import { usePredictionSearch } from '@/api/hooks/usePredictionSearch';
import { usePreferences } from '@/api/hooks/usePreferences';
import { appendNew, DEFAULT_FILTERS, NO_ROUTES, PAGE_SIZE } from '@/components/routes/routes-screen/routes-screen-helpers';
import { investmentSliderMaximum } from '@/lib/quiz-profile';
import { activeKeyword, buildRouteResults, resolveInvestmentAmount, routeMatchesKeyword, searchOutcome, shouldOfferCapitalSafe } from '@/lib/route-results';
import type { RouteFilters as Filters } from '@/lib/route-results';
import type { Route, RouteParams } from '@/types/routes';

/**
 * The list's own dials — filters, how much to invest, the most to lose, how many
 * cards are mounted — and the ranked results they produce, keyword hits included.
 */
export function useRouteResults({ baseParams, sessionParams, routes }: {
  baseParams: RouteParams | null;
  sessionParams: RouteParams | null;
  routes: Route[];
}) {
  const { preferences } = usePreferences();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [investment, setInvestment] = useState<number | null>(null);
  // Most the user is OK losing in a bad case. Null: the whole amount they'd invest.
  const [maxLoss, setMaxLoss] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const referenceStake = sessionParams?.balance ?? 1_000;
  // What the user told the profile survey they can put in beats a stake inferred from
  // the goal — a $100 goal derives $1,000 no matter how much they actually have.
  const investmentDefault = sessionParams?.investmentCeiling ?? referenceStake;
  const displayedInvestment = resolveInvestmentAmount(investment, investmentDefault);
  const investmentMaximum = investmentSliderMaximum(referenceStake, sessionParams?.investmentCeiling);

  const displayedMaxLoss = Math.min(maxLoss ?? displayedInvestment, displayedInvestment);
  function setMaxLossAndReset(amount: number): void {
    setMaxLoss(Math.max(1, Math.round(amount)));
    setVisibleCount(PAGE_SIZE);
  }

  function setInvestmentAndReset(amount: number): void {
    setInvestment(Math.max(0, Math.round(amount)));
    setVisibleCount(PAGE_SIZE);
  }
  function setFiltersAndReset(next: Filters): void {
    setFilters(next);
    setVisibleCount(PAGE_SIZE);
  }

  // Keyword search reaches past this goal's pool on both sides of the map — the whole
  // Polymarket catalog, and the whole curated fund/coin universe — so its hits are
  // merged in before scoring. Ids already present win, so a market that is both
  // searched and already a route is not duplicated.
  const keyword = activeKeyword(filters);
  const predictionSearch = usePredictionSearch(keyword, baseParams);
  const assetSearch = useAssetSearch(keyword, baseParams);
  // Gamma's search is lenient — it ORs the words, so "zorble quantis" comes back with
  // a hundred markets matching neither. The strict local match is what the list
  // actually shows, so it is also what gets merged and counted: a "149 pulled in"
  // line above an empty list is worse than no line at all.
  const searchRoutes = keyword
      ? [...predictionSearch.routes, ...assetSearch.routes].filter((route) => routeMatchesKeyword(route, keyword))
      : [];
  const searchPool = appendNew(routes, searchRoutes);

  // The user's own weighting of the four score components. Held in preferences, not
  // screen state: someone who has said they cannot afford to lose the stake means it
  // on their next search too. Editing it lives in Settings now — this screen only
  // reads it to rank the list.
  const scoreWeights = preferences.scoreWeights;

  // Deferred: a chip, a sort or a slider answers at once, and the re-rank renders
  // behind it instead of holding the tap until the whole list has been rebuilt.
  const deferredParams = useDeferredValue(sessionParams);
  const deferredInvestment = useDeferredValue(displayedInvestment);
  const deferredFilters = useDeferredValue(filters);
  const deferredMaxLoss = useDeferredValue(displayedMaxLoss);
  const isUpdating = deferredParams !== sessionParams
    || deferredInvestment !== displayedInvestment
    || deferredFilters !== filters
    || deferredMaxLoss !== displayedMaxLoss;
  const results = deferredParams
      ? buildRouteResults(searchPool, deferredParams, deferredInvestment, deferredFilters, scoreWeights, deferredMaxLoss)
      : null;

  const ranked = results?.ranked ?? [];
  const filtered = results?.filtered ?? [];
  const goalReach = results?.goalReach ?? null;
  const moreCuts = results?.moreCuts ?? NO_ROUTES;
  const isSearching = predictionSearch.isSearching || assetSearch.isSearching;
  // Matches before the filter chips narrow them: the gap between this and `filtered`
  // is what separates "we don't cover it" from "your filters are hiding it".
  const keywordMatches = keyword
    ? ranked.filter((route) => routeMatchesKeyword(route, keyword)).length
    : 0;
  const outcome = searchOutcome({
    keyword,
    matchCount: keywordMatches,
    shownCount: filtered.length,
    isSearching,
  });
  // Non-null only when the whole list is all-or-nothing *and* more capital would bring a
  // capital-preserving route back. That is a budget fact the user cannot otherwise see:
  // the safe routes were dropped as unaffordable, not missing from the market.
  const capitalSafeUnlock = results && shouldOfferCapitalSafe(filters, filtered, results.unlockCapitalSafeInvestment)
    ? results.unlockCapitalSafeInvestment
    : null;

  return {
    filters,
    setFiltersAndReset,
    referenceStake,
    displayedInvestment,
    investmentMaximum,
    setInvestmentAndReset,
    displayedMaxLoss,
    setMaxLossAndReset,
    visibleCount,
    setVisibleCount,
    keyword,
    searchRoutes,
    searchPool,
    isSearching,
    deferredParams,
    isUpdating,
    results,
    ranked,
    filtered,
    goalReach,
    moreCuts,
    outcome,
    capitalSafeUnlock,
  };
}
