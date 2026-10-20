import { isPredictionCategory } from '@/lib/prediction-topics';
import { expectedValue } from '@/lib/route-expected-value';
import { routeSubcategory } from '@/lib/route-subcategories';
import type { Route } from '@/types/routes';
import type { RouteFilters, RouteGroup, RouteSort } from '@/lib/route-results/types';

/**
 * Bands routes by market-implied chance. Bounds mirror polymarketRiskLevel in
 * @/lib/polymarket-routes so a band means the same thing here as it does when the
 * pool is built: 85+ high confidence, 65-84 likely, 35-64 a coin-flip-ish call,
 * under 35 a long shot.
 */
const CHANCE_BANDS: readonly { floor: number; label: string }[] = [
  { floor: 85, label: 'Very likely' },
  { floor: 65, label: 'Likely' },
  { floor: 35, label: 'Toss-up' },
  { floor: 0, label: 'Long shot' },
];

/**
 * Whether the prediction-only facets are live. They apply only while a prediction
 * asset class is selected — the panel that sets them is hidden otherwise, and a
 * filter the user cannot see narrowing the list is a bug, not a feature. State is
 * kept rather than cleared so returning to prediction markets restores the picks.
 */
export function predictionFacetsActive(filters: RouteFilters): boolean {
  return isPredictionCategory(filters.category);
}

/**
 * The keyword actually in force. Unlike the topic and resolution facets, this one
 * applies in every asset class: the search bar sits above the filters and is always
 * visible, so a keyword narrowing the list is always explained by a control the user
 * can see.
 */
export function activeKeyword(filters: RouteFilters): string {
  return filters.keyword.trim();
}

/**
 * Whether a route reads as a match for the typed words. Matches on the text the
 * user can actually see on the card — description, line, category and platform — so
 * a hit is always explicable by looking at it. Every word must appear, which makes
 * "messi ronaldo" narrow rather than widen.
 */
export function routeMatchesKeyword(route: Route, keyword: string): boolean {
  const words = keyword.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = `${route.description} ${route.line ?? ''} ${route.category} ${route.platform}`.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

/**
 * What a search actually turned up, as one of four states. They are different
 * problems with different answers, and collapsing them into "no results" is what
 * makes a search feel broken: "we don't cover Dogecoin" is a coverage fact, while
 * "your risk filter is hiding it" is a control the user can move.
 *
 * `matchCount` counts routes matching the keyword BEFORE the filter chips apply;
 * `shownCount` counts what survives them.
 */
export type SearchOutcome = 'idle' | 'searching' | 'uncovered' | 'filtered-out' | 'found';

export function searchOutcome({ keyword, matchCount, shownCount, isSearching }: {
  keyword: string;
  matchCount: number;
  shownCount: number;
  isSearching: boolean;
}): SearchOutcome {
  if (!keyword.trim()) return 'idle';
  // Order matters: a search still in flight has no results yet, and calling that
  // "we don't cover it" would flash a wrong answer on every keystroke.
  if (isSearching) return 'searching';
  if (matchCount === 0) return 'uncovered';
  return shownCount === 0 ? 'filtered-out' : 'found';
}

export function groupRoutesByChance(routes: Route[]): RouteGroup[] {
  return CHANCE_BANDS
    .map(({ floor, label }, index) => {
      // Bands are listed descending, so this band's ceiling is the previous band's
      // floor. Deriving it by searching for "a larger floor" would find the largest
      // one every time and make the lower bands overlap.
      const ceiling = index === 0 ? Infinity : CHANCE_BANDS[index - 1].floor;
      return {
        floor,
        label,
        routes: routes.filter((route) => route.probability >= floor && route.probability < ceiling),
      };
    })
    .filter((group) => group.routes.length > 0);
}

/** The filter chips, the prediction facets and the keyword, then the chosen sort. */
export function applyRouteFilters(
  ranked: Route[],
  filters: RouteFilters,
  keyword: string,
  selectedStake: (route: Route) => number,
): Route[] {
  let filtered = ranked;
  if (filters.category) filtered = filtered.filter((route) => route.category === filters.category);
  if (filters.category && filters.subcategory) {
    filtered = filtered.filter((route) => routeSubcategory(route)?.value === filters.subcategory);
  }
  if (filters.lossProfile) filtered = filtered.filter((route) => route.lossProfile === filters.lossProfile);
  if (filters.minimumProbability > 0) {
    filtered = filtered.filter((route) => route.probability >= filters.minimumProbability);
  }
  if (keyword) filtered = filtered.filter((route) => routeMatchesKeyword(route, keyword));
  if (predictionFacetsActive(filters)) {
    // A route with no topic is unknown, not a non-match, but it still cannot satisfy a
    // topic the user asked for — so it drops out while a topic filter is active.
    if (filters.predictionTopic) {
      filtered = filtered.filter((route) => route.predictionTopic === filters.predictionTopic);
      if (filters.predictionSubtopic) {
        filtered = filtered.filter((route) => route.predictionSubtopic === filters.predictionSubtopic);
      }
    }
    if (filters.maxDaysToResolve != null) {
      const limit = filters.maxDaysToResolve;
      filtered = filtered.filter((route) => (route.maturesInDays ?? Infinity) <= limit);
    }
  }
  if (filters.sort !== 'score') filtered = [...filtered].sort(sortComparator(filters.sort, selectedStake));
  return filtered;
}

export function sortComparator(
  sort: Exclude<RouteSort, 'score'>,
  stakeFor: (route: Route) => number,
): (a: Route, b: Route) => number {
  switch (sort) {
    case 'chance': return (a, b) => b.probability - a.probability;
    // 'payout' is the headline win-only figure, honest to its label. 'value' weights
    // that payout by the odds, so a longshot stops outranking a T-bill by default.
    case 'payout': return (a, b) => b.expectedReturn - a.expectedReturn;
    case 'value': return (a, b) => expectedValue(b, stakeFor(b)) - expectedValue(a, stakeFor(a));
    case 'soonest': return (a, b) => (a.maturesInDays ?? Number.MAX_SAFE_INTEGER) - (b.maturesInDays ?? Number.MAX_SAFE_INTEGER);
    case 'type': return (a, b) => a.category.localeCompare(b.category);
  }
}
