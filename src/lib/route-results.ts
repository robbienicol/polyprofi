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

export function buildRouteResults(
  routes: Route[],
  params: RouteParams,
  investment: number,
  autoSize: boolean,
  filters: RouteFilters
): RouteResults {
  const referenceStake = params.balance || 1;
  const target = params.target || 1;
  const requiredInvestmentById = new Map(
    routes.map((route) => [
      route.id,
      stakeNeededForReturn(route, referenceStake, target),
    ] as const)
  );
  const selectedStake = (route: Route): number => autoSize
    ? requiredInvestmentById.get(route.id) ?? referenceStake
    : investment || target || referenceStake;
  const rescored = routes.map((route) => (
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
