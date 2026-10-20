/**
 * The ranked, filtered route list a search screen shows. The pieces live in
 * @/lib/route-results/: the types, the filter chips and search, the relevance gates,
 * and the build that strings them together.
 */
export type {
  GoalReach,
  RouteFilters,
  RouteGroup,
  RouteResults,
  RouteSort,
} from '@/lib/route-results/types';
export {
  activeKeyword,
  groupRoutesByChance,
  predictionFacetsActive,
  routeMatchesKeyword,
  searchOutcome,
  type SearchOutcome,
} from '@/lib/route-results/filters';
export {
  NEAR_MISS_MAX_STAKE_STRETCH,
  NEAR_MISS_MIN_PROXIMITY,
  isRelevantRoute,
  isWorthShowing,
  resolveInvestmentAmount,
  shouldOfferCapitalSafe,
  withoutDominated,
  type RouteRelevanceInput,
} from '@/lib/route-results/relevance';
export { buildRouteResults } from '@/lib/route-results/build';
export { __selfCheck } from '@/lib/route-results/check';
