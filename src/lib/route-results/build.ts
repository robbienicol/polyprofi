import { timeframeCalendarDays } from '@/api/client/playbook';
import {
  DEFAULT_SCORE_WEIGHTS,
  goalEffectivenessScore,
  type GoalScoreContext,
  type ScoreWeights,
} from '@/lib/score';
import { applyCutShortlist, isSpendingCut, shortlistCuts } from '@/lib/cut-shortlist';
import { compareGoalOdds, goalOdds } from '@/lib/goal-odds';
import { rescoreForStake, stakeNeededForReturn } from '@/lib/stake-rescore';
import { activeKeyword, applyRouteFilters } from '@/lib/route-results/filters';
import { cashYieldPct, isRelevantRoute, isWorthShowing, withoutDominated } from '@/lib/route-results/relevance';
import type { GoalReach, RouteFilters, RouteResults } from '@/lib/route-results/types';
import type { Route, RouteParams } from '@/types/routes';

export function buildRouteResults(
  routes: Route[],
  params: RouteParams,
  investment: number,
  filters: RouteFilters,
  /** The user's own weighting of the four score components. See `@/lib/score`. */
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS,
  /** Most the user is OK losing in a bad case. Null: up to the whole amount. */
  maxLoss: number | null = null,
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
  // "N ways to make $X" count all reflect only routes worth showing, judged against
  // the amount the user said they are willing to invest. A keyword search is the one
  // exception: the user named what they want, so hiding a match for missing the goal
  // would look broken. The score and the "below current goal" label still say so.
  const keyword = activeKeyword(filters);
  // What each route would actually pay at the amount the user intends to invest.
  // Computed once: the relevance gate and the reachability answer below both need it,
  // and rescoring the pool twice is the same work done twice.
  const projectedAtIntended = new Map(
    routes.map((route) => [
      route.id,
      rescoreForStake([route], referenceStake, intendedInvestment, target)[0].expectedReturn,
    ] as const)
  );
  const relevantRoutes = keyword
    ? routes
    : routes.filter((route) =>
      isRelevantRoute({
        target,
        projectedReturn: projectedAtIntended.get(route.id) ?? 0,
        requiredInvestment: requiredInvestmentById.get(route.id) ?? null,
        intendedInvestment,
        noCapitalRequired: route.noCapitalRequired,
      })
    );
  const shownRoutes = keyword ? relevantRoutes : withoutDominated(relevantRoutes, requiredInvestmentById);
  const deadlineDays = timeframeCalendarDays(params.timeframe);
  const oddsById = new Map(
    shownRoutes.map((route) => [
      route.id,
      goalOdds(route, {
        target,
        budget: intendedInvestment,
        maxLoss,
        deadlineDays,
        requiredStake: requiredInvestmentById.get(route.id) ?? null,
      }),
    ] as const)
  );
  // Spend only what a route needs to reach the target, never more than the user is
  // willing to invest, and never more than the loss cap allows.
  const selectedStake = (route: Route): number => {
    const odds = oddsById.get(route.id);
    if (odds) return odds.stake;
    const requiredInvestment = requiredInvestmentById.get(route.id);
    return Math.min(requiredInvestment ?? intendedInvestment, intendedInvestment);
  };
  // What the same money would earn in cash over the goal's own timeframe.
  const cashYield = cashYieldPct(routes);
  const cashReturnRate = cashYield != null
    ? (cashYield / 100) * (timeframeCalendarDays(params.timeframe) / 365)
    : null;
  const rescored = shownRoutes
    .map((route) => {
      const atStake = rescoreForStake([route], referenceStake, selectedStake(route), target)[0];
      // A fund's odds depend on the stake, so the card shows the odds at the size it
      // was given, and what it pays if it works is the goal itself.
      const odds = oddsById.get(route.id);
      return route.dailyVolatility != null && odds
        ? { ...atStake, probability: odds.chance, expectedReturn: odds.profitIfItWorks, meetsTarget: odds.hitsGoal }
        : atStake;
    })
    // A named search shows what was asked for, worth it or not; the card still says so.
    .filter((route) => keyword || isWorthShowing(route, selectedStake(route), cashReturnRate));
  const scoreContext = (route: Route): GoalScoreContext => ({
    target,
    requiredInvestment: requiredInvestmentById.get(route.id) ?? null,
    availableInvestment: intendedInvestment,
    deadlineDays: timeframeCalendarDays(params.timeframe),
  });
  const scoreById = new Map(
    rescored.map((route) => [route.id, goalEffectivenessScore(route, scoreContext(route), weights)] as const)
  );
  // Ranked by chance of reaching the goal at a stake inside the loss cap — the one
  // number a user can check. The weighted score stays available to the detail screen.
  const ranked = rescored
    .map((route) => ({ route, odds: oddsById.get(route.id)! }))
    .sort(compareGoalOdds)
    .map(({ route }) => route);

  let filtered = applyRouteFilters(ranked, filters, keyword, selectedStake);

  // A handful of cuts next to the investments, not ten of them in front. See
  // @/lib/cut-shortlist. Asking for cuts outright — the category, or by name —
  // shows every one of them.
  let moreCuts: Route[] = [];
  const cutsRequested = keyword || filters.category === 'Cut spending' || filters.category === 'Card rewards';
  if (!cutsRequested && filtered.some(isSpendingCut)) {
    const shortlist = shortlistCuts(filtered, target);
    moreCuts = shortlist.more;
    filtered = applyCutShortlist(filtered, shortlist, filters.sort === 'score');
  }

  // A high chance of hitting the goal is the property of safe, low-yield routes, and those
  // need real capital: a T-bill clears a $300 goal only at a few thousand dollars. So they
  // are the first to be dropped as unreachable near-misses when the intended amount is
  // small, and "no routes with ≥ 90% chance" is usually a budget message rather than a
  // market one. This is the number that answers it. Null when more money would not help —
  // no such route exists, or one is already affordable and another filter is hiding it.
  const unlockInvestmentFor = (minimumProbability: number): number | null => {
    const needed = routes
      .filter((route) => route.probability >= minimumProbability)
      .filter((route) => !filters.category || route.category === filters.category)
      .filter((route) => !filters.lossProfile || route.lossProfile === filters.lossProfile)
      .map((route) => requiredInvestmentById.get(route.id))
      .filter((amount): amount is number => amount != null && amount > intendedInvestment);
    return needed.length > 0 ? Math.min(...needed) : null;
  };

  // The same question asked of capital preservation instead of probability. A user with a
  // small budget and a big goal gets a list of nothing but binary contracts — not because
  // the safe routes are missing, but because a T-bill needs real capital to clear a +$300
  // goal and `isRelevantRoute` dropped it as unreachable. Silence there is what makes the
  // app look like it only deals in all-or-nothing bets, so this is the number that answers
  // it. Read off the whole pool, not the filtered list, since the point is what is absent.
  const capitalSafeCandidates = routes
    .filter((route) => route.lossProfile === 'partial')
    .map((route) => requiredInvestmentById.get(route.id))
    .filter((amount): amount is number => amount != null && amount > intendedInvestment);
  const unlockCapitalSafeInvestment = capitalSafeCandidates.length > 0
    ? Math.min(...capitalSafeCandidates)
    : null;

  /*
   * Reachability, read off the whole pool rather than the filtered list.
   *
   * `bestProjectedReturn` is the most any route pays at the amount the user said they
   * would invest — the honest ceiling. `investmentToReach` is the smallest stake that
   * makes some route clear the target, which is the only actionable half of a "no":
   * without it the answer is a shrug, and with it the answer is a button.
   *
   * Null there means more money would not help either, so the copy has to fall back to
   * the other two dials the user owns — the amount asked for and the deadline.
   */
  const bestProjectedReturn = routes.length > 0
    ? Math.max(...routes.map((route) => projectedAtIntended.get(route.id) ?? 0))
    : 0;
  const stakesThatReach = routes
    .map((route) => requiredInvestmentById.get(route.id))
    .filter((amount): amount is number => amount != null && Number.isFinite(amount) && amount > 0);
  const goalReach: GoalReach = {
    target: params.target,
    bestProjectedReturn,
    proximity: params.target > 0 ? Math.max(0, bestProjectedReturn / params.target) : 1,
    reachable: params.target <= 0 || bestProjectedReturn >= params.target,
    investmentToReach: stakesThatReach.length > 0 ? Math.min(...stakesThatReach) : null,
    poolSize: routes.length,
  };

  return {
    ranked,
    filtered,
    requiredInvestmentById,
    scoreById,
    oddsById,
    selectedStake,
    unlockInvestmentFor,
    unlockCapitalSafeInvestment,
    moreCuts,
    goalReach,
  };
}
