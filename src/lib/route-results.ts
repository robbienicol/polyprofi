import { timeframeCalendarDays } from '@/api/client/playbook';
import { goalEffectivenessScore, sortByPolyProfitScore } from '@/lib/score';
import type { GoalScoreBreakdown, GoalScoreContext } from '@/lib/score';
import { rescoreForStake, stakeNeededForReturn } from '@/lib/stake-rescore';
import type { Route, RouteParams } from '@/types/routes';

export type RouteSort = 'score' | 'safest' | 'chance' | 'payout' | 'soonest' | 'type';

export interface RouteFilters {
  category: string | null;
  lossProfile: Route['lossProfile'] | null;
  minimumProbability: number;
  sort: RouteSort;
}

export interface RouteResults {
  ranked: Route[];
  filtered: Route[];
  requiredInvestmentById: Map<string, number | null>;
  scoreById: Map<string, GoalScoreBreakdown>;
  selectedStake: (route: Route) => number;
}

/**
 * Near-miss relevance. A route that MISSES the goal at the amount the user actually
 * intends to invest is only worth showing if it's close on BOTH axes: close to the goal,
 * and reachable without demanding far more capital than the user wants to put in. Otherwise
 * it's noise (e.g. a T-bill projecting +$199 toward a +$300 goal that would need $3k more).
 * Thresholds are reciprocals by design (1 / 0.8 = 1.25), so for a route whose return scales
 * linearly with stake the two checks coincide; both are kept so non-linear routes still get
 * judged on each axis.
 */
export const NEAR_MISS_MIN_PROXIMITY = 0.8; // show only if projected ≥ 80% of the goal
export const NEAR_MISS_MAX_STAKE_STRETCH = 1.25; // …and reachable within 1.25× the intended amount

export interface RouteRelevanceInput {
  target: number;
  projectedReturn: number; // profit at the user's INTENDED stake (not an auto-sized one)
  requiredInvestment: number | null; // stake needed to actually hit the goal
  intendedInvestment: number; // what the user wants to invest
}

export function isRelevantRoute({
  target,
  projectedReturn,
  requiredInvestment,
  intendedInvestment,
}: RouteRelevanceInput): boolean {
  if (target <= 0) return true; // no goal set → nothing to be irrelevant against
  if (projectedReturn >= target) return true; // hits the goal at the intended amount → always show
  const closeToGoal = projectedReturn >= target * NEAR_MISS_MIN_PROXIMITY;
  const withinPriceRange =
    requiredInvestment != null &&
    intendedInvestment > 0 &&
    requiredInvestment <= intendedInvestment * NEAR_MISS_MAX_STAKE_STRETCH;
  return closeToGoal && withinPriceRange;
}

export function buildRouteResults(
  routes: Route[],
  params: RouteParams,
  investment: number,
  autoSize: boolean,
  filters: RouteFilters
): RouteResults {
  const referenceStake = params.balance || 1;
  const target = params.target || 1;
  const intendedInvestment = investment || target || referenceStake;
  const requiredInvestmentById = new Map(
    routes.map((route) => [
      route.id,
      stakeNeededForReturn(route, referenceStake, target),
    ] as const)
  );
  // Drop irrelevant near-misses before anything else, so scores, ranking, and the
  // "N ways to make $X" count all reflect only routes worth showing (judged against
  // the amount the user intends to invest, independent of the auto-size toggle).
  const relevantRoutes = routes.filter((route) =>
    isRelevantRoute({
      target,
      projectedReturn: rescoreForStake([route], referenceStake, intendedInvestment, target)[0].expectedReturn,
      requiredInvestment: requiredInvestmentById.get(route.id) ?? null,
      intendedInvestment,
    })
  );
  const selectedStake = (route: Route): number => {
    if (!autoSize) return intendedInvestment;
    const requiredInvestment = requiredInvestmentById.get(route.id);
    return Math.min(requiredInvestment ?? intendedInvestment, intendedInvestment);
  };
  const rescored = relevantRoutes.map((route) => (
    rescoreForStake([route], referenceStake, selectedStake(route), target)[0]
  ));
  const scoreContext = (route: Route): GoalScoreContext => ({
    target,
    requiredInvestment: requiredInvestmentById.get(route.id) ?? null,
    availableInvestment: autoSize ? referenceStake : investment || target || referenceStake,
    deadlineDays: timeframeCalendarDays(params.timeframe),
  });
  const scoreById = new Map(
    rescored.map((route) => [route.id, goalEffectivenessScore(route, scoreContext(route))] as const)
  );
  const ranked = sortByPolyProfitScore(rescored, scoreContext);

  let filtered = ranked;
  if (filters.category) filtered = filtered.filter((route) => route.category === filters.category);
  if (filters.lossProfile) filtered = filtered.filter((route) => route.lossProfile === filters.lossProfile);
  if (filters.minimumProbability > 0) {
    filtered = filtered.filter((route) => route.probability >= filters.minimumProbability);
  }
  if (filters.sort !== 'score') filtered = [...filtered].sort(sortComparator(filters.sort));

  return { ranked, filtered, requiredInvestmentById, scoreById, selectedStake };
}

// ── self-check ──────────────────────────────────────────────────────────────
export function __selfCheck(): void {
  // The reported case: +$300 goal, intends $4,901; T-bill projects +$199 and needs $7,378.
  const tbill = { target: 300, projectedReturn: 199, requiredInvestment: 7378, intendedInvestment: 4901 };
  console.assert(!isRelevantRoute(tbill), 'far-off T-bill (66% of goal, 1.5× capital) is hidden');

  // Hits the goal at the intended amount → always shown.
  console.assert(
    isRelevantRoute({ target: 300, projectedReturn: 300, requiredInvestment: 4901, intendedInvestment: 4901 }),
    'route that hits the goal at the intended amount is shown',
  );

  // Genuine near-miss: 81% of goal, needs only ~1.23× the intended amount → shown.
  console.assert(
    isRelevantRoute({ target: 300, projectedReturn: 244, requiredInvestment: 6000, intendedInvestment: 4901 }),
    'near-miss within both bars is shown',
  );

  // Just over the price-range line (needs >1.25× intended) → hidden.
  console.assert(
    !isRelevantRoute({ target: 300, projectedReturn: 235, requiredInvestment: 6200, intendedInvestment: 4901 }),
    'needs more than 1.25× the intended amount → hidden',
  );

  // Route that can never reach the goal at any stake (no required investment) → hidden.
  console.assert(
    !isRelevantRoute({ target: 300, projectedReturn: 150, requiredInvestment: null, intendedInvestment: 4901 }),
    'route with no path to the goal is hidden',
  );

  // No goal set → never filtered.
  console.assert(
    isRelevantRoute({ target: 0, projectedReturn: 0, requiredInvestment: null, intendedInvestment: 4901 }),
    'no goal → nothing is filtered out',
  );

  const params: RouteParams = {
    balance: 1000,
    target: 100,
    timeframe: 'week',
    categories: [],
    riskTolerance: 'balanced',
    maxRiskLevel: 5,
    minProbability: 0,
  };
  const filters: RouteFilters = {
    category: null,
    lossProfile: null,
    minimumProbability: 0,
    sort: 'score',
  };
  const reportedRoute: Route = {
    id: 'reported-87c',
    category: 'Polymarket',
    emoji: '🔮',
    description: 'Reported 87¢ contract',
    riskLevel: 2,
    probability: 87,
    expectedReturn: 149,
    platform: 'Polymarket',
    strategy: '',
    line: 'No 87¢',
    maturesInDays: 7,
    lossProfile: 'binary',
    meetsTarget: true,
  };
  const autoSized = buildRouteResults([reportedRoute], params, 1000, true, filters);
  const sizedRoute = autoSized.ranked[0];
  console.assert(
    autoSized.selectedStake(sizedRoute) === 670 && sizedRoute.expectedReturn === 100,
    '87¢ route uses $670 to make the $100 goal instead of risking the full $1,000',
  );

  const overBudgetRoute: Route = {
    ...reportedRoute,
    id: 'over-budget',
    category: 'Stocks & ETFs',
    probability: 90,
    expectedReturn: 80,
    line: undefined,
    lossProfile: 'partial',
  };
  const capped = buildRouteResults([overBudgetRoute], params, 1000, true, filters);
  console.assert(
    capped.selectedStake(capped.ranked[0]) === 1000 && capped.ranked[0].expectedReturn === 80,
    'auto-size never exceeds the amount the user has available',
  );
}

function sortComparator(sort: Exclude<RouteSort, 'score'>): (a: Route, b: Route) => number {
  switch (sort) {
    case 'safest':
      return (a, b) => {
        const risk = a.riskLevel - b.riskLevel;
        const lossShape = Number(a.lossProfile === 'binary') - Number(b.lossProfile === 'binary');
        return risk || lossShape || b.probability - a.probability;
      };
    case 'chance': return (a, b) => b.probability - a.probability;
    case 'payout': return (a, b) => b.expectedReturn - a.expectedReturn;
    case 'soonest': return (a, b) => (a.maturesInDays ?? Number.MAX_SAFE_INTEGER) - (b.maturesInDays ?? Number.MAX_SAFE_INTEGER);
    case 'type': return (a, b) => a.category.localeCompare(b.category);
  }
}
