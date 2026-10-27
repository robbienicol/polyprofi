import { buildRouteResults } from '@/lib/route-results/build';
import { isRelevantRoute, isWorthShowing, resolveInvestmentAmount } from '@/lib/route-results/relevance';
import type { RouteFilters } from '@/lib/route-results/types';
import type { Route, RouteParams } from '@/types/routes';

/** Reachability, the worth-showing test and the near-miss relevance gate. */
export function checkGates(): void {
  // The honest-no signal. A pool that cannot reach the target must report unreachable
  // with the gap measured, because the screen renders its verdict straight off this.
  {
    const params: RouteParams = {
      target: 12_000, balance: 500, timeframe: 'month',
    } as RouteParams;
    const short: Route = {
      id: 'short', category: 'Savings & Treasuries', emoji: '', description: '', riskLevel: 1,
      probability: 99, expectedReturn: 20, platform: '', strategy: '', lossProfile: 'partial', meetsTarget: false,
    };
    const filters: RouteFilters = {
      category: null, lossProfile: null, minimumProbability: 0, sort: 'score',
      predictionTopic: null, maxDaysToResolve: null, groupByChance: false, keyword: '',
    };
    const { goalReach } = buildRouteResults([short], params, 500, filters);
    console.assert(!goalReach.reachable, 'a pool that tops out at +$20 does not reach a +$12,000 goal');
    console.assert(goalReach.proximity < 0.01, 'proximity reports how far short it falls');
    console.assert(goalReach.poolSize === 1, 'poolSize counts what was judged, before relevance dropped anything');

    const reaches: Route = { ...short, id: 'reaches', expectedReturn: 12_500, meetsTarget: true };
    console.assert(buildRouteResults([reaches], params, 500, filters).goalReach.reachable, 'a route that clears the target reports reachable');
    console.assert(buildRouteResults([], params, 500, filters).goalReach.poolSize === 0, 'an empty pool is not a verdict about the goal');
  }

  {
    const base: Route = {
      id: 'x', category: 'Polymarket', emoji: '', description: '', riskLevel: 3, probability: 50,
      expectedReturn: 300, platform: '', strategy: '', lossProfile: 'partial', meetsTarget: true,
    };
    const yearOfCash = 0.04;
    // The reported route: a 1.5% four-day bracket, $20,000 to make $300, 50/50, stop at −1.8%.
    const bracket: Route = { ...base, exitPlan: { kind: 'bracket', effectiveLossFraction: 0.018 } as Route['exitPlan'] };
    console.assert(!isWorthShowing(bracket, 20_000, yearOfCash), 'a bracket that loses on average and trails a T-bill is hidden');
    console.assert(!isWorthShowing(bracket, 20_000, null), 'the bracket fails on expected value alone, cash aside');
    const longshot: Route = { ...base, lossProfile: 'binary', probability: 3, expectedReturn: 32_333, riskLevel: 5 };
    console.assert(isWorthShowing(longshot, 1_000, yearOfCash), 'a fairly-priced 3¢ long shot is not "losing" just because its price was rounded');
    const fairHold: Route = { ...base, lossProfile: 'binary', probability: 60, expectedReturn: 667, riskLevel: 3 };
    console.assert(isWorthShowing(fairHold, 1_000, yearOfCash), 'a fairly-priced contract that beats cash stays');
    const losing: Route = { ...fairHold, probability: 30 };
    console.assert(!isWorthShowing(losing, 1_000, yearOfCash), 'a contract that loses on average is hidden');
    const tinyStock: Route = { ...base, category: 'Stocks & ETFs', lossProfile: 'partial', expectedReturn: 30 };
    console.assert(!isWorthShowing(tinyStock, 1_000, yearOfCash), '3% at risk when cash pays 4% is hidden');
    console.assert(isWorthShowing({ ...tinyStock, expectedReturn: 90 }, 1_000, yearOfCash), '9% at risk against 4% cash stays');
    const bill: Route = { ...base, category: 'Savings & Treasuries', expectedReturn: 10 };
    console.assert(isWorthShowing(bill, 1_000, yearOfCash), 'cash is never judged against itself');
    console.assert(isWorthShowing(tinyStock, 1_000, null), 'with no cash rate to compare against, nothing is hidden for it');
  }

  if (resolveInvestmentAmount(null, 1000) !== 1000) {
    throw new Error('an untouched investment amount uses the saved default');
  }
  if (resolveInvestmentAmount(0, 1000) !== 0) {
    throw new Error('a temporarily empty investment input stays empty while editing');
  }

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

  // …unless it costs nothing. A $30 cut against a $300 goal is 10% of it and would fail
  // both bars, but it is free and it stacks with the next one.
  console.assert(
    isRelevantRoute({ target: 300, projectedReturn: 30, requiredInvestment: 0, intendedInvestment: 4901, noCapitalRequired: true }),
    'a zero-capital route is never filtered out for falling short of the goal alone',
  );
  console.assert(
    !isRelevantRoute({ target: 300, projectedReturn: 30, requiredInvestment: 0, intendedInvestment: 4901 }),
    '…and a route that DOES consume the stake still is',
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
}
