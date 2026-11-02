import { downsideAtStake, expectedValue } from '@/lib/route-expected-value';
import { isDebtRoute } from '@/lib/route-investment-metrics';
import { activeKeyword } from '@/lib/route-results/filters';
import type { RouteFilters } from '@/lib/route-results/types';
import type { Route } from '@/types/routes';

export function resolveInvestmentAmount(editedAmount: number | null, referenceStake: number): number {
  return editedAmount ?? referenceStake;
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
  /** Costs nothing to take, so it never competes for the stake. */
  noCapitalRequired?: boolean;
}

export function isRelevantRoute({
  target,
  projectedReturn,
  requiredInvestment,
  intendedInvestment,
  noCapitalRequired,
}: RouteRelevanceInput): boolean {
  if (target <= 0) return true; // no goal set → nothing to be irrelevant against
  if (projectedReturn >= target) return true; // hits the goal at the intended amount → always show
  /*
   * A zero-capital route is exempt, and the premise above is why.
   *
   * This gate asks whether a route is worth a slot given it would consume the stake
   * without reaching the goal. Of a route that consumes no stake, the question does
   * not arise. Cuts also STACK in a way market routes do not — you pick one contract,
   * but you cancel every subscription — so judging each one alone against 80% of the
   * goal hid all ten of them, five of which were free money, behind a single T-bill.
   */
  if (noCapitalRequired) return true;
  const closeToGoal = projectedReturn >= target * NEAR_MISS_MIN_PROXIMITY;
  const withinPriceRange =
    requiredInvestment != null &&
    intendedInvestment > 0 &&
    requiredInvestment <= intendedInvestment * NEAR_MISS_MAX_STAKE_STRETCH;
  return closeToGoal && withinPriceRange;
}

/**
 * Whether to offer the "invest more and capital-preserving routes appear" nudge.
 *
 * Three conditions, each of them about not misleading the user:
 *  - nothing currently listed preserves capital, so the offer is news rather than nagging;
 *  - some amount genuinely unlocks one, so it never promises a route that does not exist;
 *  - the user has not asked for all-or-nothing, narrowed to a single asset class, or
 *    searched for a market by name — in each case the absent safe routes are their own
 *    choice rather than a budget problem, and "everything here is all-or-nothing" is
 *    just a restatement of what they typed.
 *
 * Judged on the whole filtered list rather than the visible page: a capital-preserving
 * route sitting on page two would make "everything here is all-or-nothing" a lie.
 */
export function shouldOfferCapitalSafe(
  filters: RouteFilters,
  filteredRoutes: Route[],
  unlockAmount: number | null,
): boolean {
  if (unlockAmount == null) return false;
  if (filters.lossProfile != null || filters.category != null) return false;
  if (activeKeyword(filters) !== '') return false;
  return !filteredRoutes.some((route) => route.lossProfile === 'partial');
}

/**
 * Slack on the losing-bet test, in probability: prices are rounded to a whole percent
 * before they become a route's chance, so a fairly-priced contract can read up to half
 * a point short. Anything worse than this is a genuinely losing bet, not rounding.
 */
const EV_PROBABILITY_SLACK = 0.006;

/**
 * Whether a route is worth putting in front of someone at all, on two tests the
 * goal-based filters never asked:
 *
 * 1. It must not be a losing bet. For routes whose downside is concrete — an
 *    all-or-nothing contract, or one with a stop — chance × gain has to cover
 *    chance-of-losing × loss. A fairly-priced contract sits at zero and passes; a
 *    bracket, which pays its spread twice, is negative by construction and does not.
 * 2. Even if it works, it must beat cash. A route that puts money at risk and, at
 *    best, returns less over the goal's timeframe than a T-bill would with none, is
 *    strictly worse than the T-bill: a 1.5% four-day trade against a year-long goal
 *    was being shown as "$20,000 to make $300" beside a 4% bill.
 *
 * Spending cuts, card moves and cash instruments themselves are never judged here.
 */
export function isWorthShowing(route: Route, stake: number, cashReturnRate: number | null): boolean {
  if (route.noCapitalRequired || route.category === 'Savings & Treasuries' || isDebtRoute(route)) return true;
  if ((route.lossProfile === 'binary' || route.exitPlan) && stake > 0) {
    const swing = route.expectedReturn + downsideAtStake(route, stake);
    if (expectedValue(route, stake) < -EV_PROBABILITY_SLACK * swing) return false;
  }
  if (cashReturnRate != null && cashReturnRate > 0 && stake > 0) {
    if (route.expectedReturn / stake <= cashReturnRate) return false;
  }
  return true;
}

/**
 * Drops a route when another of the same kind beats it on every axis that matters:
 * needs no more money, pays back no later, and is no less likely to work. Ten T-bills
 * all making the goal at 99% were listed side by side, and the one tying up $60,000
 * for the same three months as one needing $30,000 had no reason to be there. A
 * route that is quicker or more certain stays, since that is a real trade-off.
 *
 * Routes with no known stake or maturity are never compared: unknown is not worse.
 * Nor are stock and crypto routes: they are priced to need the full stake and run
 * to the deadline by construction, so stake and days always tie and probability
 * alone decided — which cut 29 funds down to one. Their real differences (how far
 * they swing, what they hold) are not on these axes.
 */
const VOLATILITY_PRICED = /^(etf|crypto)-/;

export function withoutDominated(routes: Route[], requiredInvestmentById: Map<string, number | null>): Route[] {
  const comparable = (route: Route): { stake: number; days: number } | null => {
    const stake = requiredInvestmentById.get(route.id);
    if (route.noCapitalRequired || stake == null || route.maturesInDays == null || VOLATILITY_PRICED.test(route.id)) return null;
    return { stake, days: route.maturesInDays };
  };
  return routes.filter((route) => {
    const own = comparable(route);
    if (!own) return true;
    return !routes.some((other) => {
      if (other.id === route.id || other.category !== route.category || other.lossProfile !== route.lossProfile) return false;
      const theirs = comparable(other);
      if (!theirs) return false;
      const noWorse = theirs.stake <= own.stake && theirs.days <= own.days && other.probability >= route.probability;
      const better = theirs.stake < own.stake || theirs.days < own.days || other.probability > route.probability;
      return noWorse && better;
    });
  });
}

/** The best sourced cash yield in the pool, as a percent a year — the bar every risky route has to clear. */
export function cashYieldPct(routes: Route[]): number | null {
  const yields = routes
    .filter((route) => route.category === 'Savings & Treasuries')
    .map((route) => route.investmentFacts?.yieldPct)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
  return yields.length > 0 ? Math.max(...yields) : null;
}
