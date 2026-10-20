import type { MarketContext, PolymarketEntry } from '@/api/client/market-data-types';
import type { OptionChain } from '@/api/client/options-chain-types';
import { playbookRoutes, targetBucket, timeframeCalendarDays } from '@/api/client/playbook';
import { buildCryptoRoutes } from '@/lib/crypto-routes';
import { buildEtfRoutes } from '@/lib/etf-routes';
import { applySourcedDebtFacts } from '@/lib/factual-route-data';
import { buildOptionsRoutes } from '@/lib/options-routes';
import { buildPolymarketRoutes } from '@/lib/polymarket-routes';
import { enforceRouteIntegrity } from '@/lib/quiz-profile';
import { isDebtRoute } from '@/lib/route-investment-metrics';
import { buildSavingsAccountRoute, buildTreasuryRoutes } from '@/lib/savings-treasury-routes';
import { sortByPatheyScore } from '@/lib/score';
import { stakeNeededForReturn } from '@/lib/stake-rescore';
import type { Route, RouteParams } from '@/types/routes';

/**
 * Turns market data into the pool of routes a search ranks. Pure: the server runs it
 * against its cached snapshot, and the device runs it only as a fallback when the
 * server can't be reached.
 *
 * Only the goal shapes the pool — amount, target and deadline. The user's own filters
 * (risk level, categories, minimum chance) are NOT applied here: a pool is cached and
 * shared by everyone with a similar goal, and baking one user's filters into it handed
 * the next user someone else's choices. The device filters after it arrives.
 */

export type PoolGoal = Pick<RouteParams, 'balance' | 'target' | 'timeframe'>;

export interface PoolInputs {
  market: MarketContext;
  universe: PolymarketEntry[];
  optionChains: OptionChain[];
  /** The shared AI slate, unpriced. */
  aiSlate: Route[];
}

const POOL_VERSION = 'pool-v1';

/**
 * One pool per deadline and RETURN BAND, not per dollar target. A $300 and a $305 goal
 * reuse one pool; the exact target is honoured per user on the device (rescoreForStake
 * and the relevance filter).
 */
export function routePoolKey(goal: PoolGoal): string {
  const returnPct = goal.balance > 0 ? (goal.target / goal.balance) * 100 : 0;
  return [POOL_VERSION, goal.timeframe, `r${targetBucket(returnPct)}`].join('|');
}

/** A binary contract bought at price p returns stake × (1/p − 1) if it resolves in your favour. */
function priceSlateRoute(route: Route, goal: PoolGoal, fallbackMaturity: number): Route {
  const price = route.probability / 100;
  const expectedReturn = price > 0 && price < 1 ? Math.round(goal.balance * (1 / price - 1)) : 0;
  return {
    ...route,
    expectedReturn,
    meetsTarget: expectedReturn >= goal.target,
    maturesInDays: route.maturesInDays && route.maturesInDays > 0 ? Math.round(route.maturesInDays) : fallbackMaturity,
  };
}

export function buildRoutePool({ market, universe, optionChains, aiSlate }: PoolInputs, goal: PoolGoal): Route[] {
  const { balance, target, timeframe } = goal;
  const returnPct = balance > 0 ? (target / balance) * 100 : 0;
  const deadlineDays = timeframeCalendarDays(timeframe);
  const sizing = { balance, target, deadlineDays };

  const baselineRoutes = playbookRoutes(returnPct, timeframe, target, { stocks: market.stocks });
  const treasuryRoutes = buildTreasuryRoutes({ yields: market.treasuryBillYields, ...sizing });
  const savingsAccountRoutes = buildSavingsAccountRoute({ yields: market.treasuryBillYields, ...sizing });
  const etfRoutes = buildEtfRoutes({ quotes: market.stocks, ...sizing });
  const cryptoRoutes = buildCryptoRoutes({ quotes: market.stocks, ...sizing });
  const optionsRoutes = buildOptionsRoutes({
    chains: optionChains,
    ...sizing,
    riskFreePct: market.stocks.find((quote) => quote.symbol === '^IRX')?.price ?? 0,
  });
  // The playbook's generic "OTM options" / "Selling premium" picks stand in for options
  // only when there are no live contracts to show in their place.
  const playbook = optionsRoutes.length > 0
    ? baselineRoutes.filter((route) => route.platform !== 'Options brokerage')
    : baselineRoutes;
  const baselines = treasuryRoutes.length > 0 ? playbook.filter((route) => !isDebtRoute(route)) : playbook;
  // The AI is scoped to Polymarket; hard-guard it so a stray stock/treasury route can't slip in
  // and collide with the deterministic builders that own those categories.
  const aiRoutes = aiSlate
    .filter((route) => /polymarket/i.test(route.category))
    .map((route) => priceSlateRoute(route, goal, deadlineDays));

  const sourced = applySourcedDebtFacts(
    [...treasuryRoutes, ...savingsAccountRoutes, ...etfRoutes, ...cryptoRoutes, ...optionsRoutes, ...baselines, ...aiRoutes],
    market.stocks,
    balance,
    deadlineDays,
    target,
  );
  const tailored = enforceRouteIntegrity(sourced, target);
  const livePolymarket = enforceRouteIntegrity(buildPolymarketRoutes(universe, goal), target);
  const merged = [...new Map([...tailored, ...livePolymarket].map((route) => [route.id, route])).values()];
  return sortByPatheyScore(merged, (route) => ({
    target,
    requiredInvestment: stakeNeededForReturn(route, balance, target),
    availableInvestment: balance,
    deadlineDays,
  }));
}
