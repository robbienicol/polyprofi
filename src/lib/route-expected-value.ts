import { Route } from '@/types/routes';

/**
 * Honest expected value for a route.
 *
 * `Route.expectedReturn` is the profit **if the route works out** — for a
 * Polymarket contract that is `stake × (1/price − 1)`, which at 3¢ is a 32×
 * return that happens 3% of the time. Treasury and savings routes put their
 * near-certain profit in the same field. Comparing the two numbers directly
 * makes every longshot look strictly better than every safe route, so anything
 * that ranks or judges routes needs the probability-weighted figure instead.
 *
 * The field name stays `expectedReturn` because it is persisted in AsyncStorage
 * and required by `isRoute`/`isTrackedBet`; renaming it would fail validation on
 * every saved batch and tracked position. `winProfit()` names it honestly at the
 * call sites that care.
 */

/** Rough drawdown fraction per risk level, matching the downside shown on cards. */
const DRAWDOWN_PER_RISK_LEVEL = 0.08;

/** Profit if the route succeeds. Not an expectation — see `expectedValue`. */
export function winProfit(route: Route): number {
  return route.expectedReturn;
}

/** The downside in dollars if the route fails at this stake. */
export function downsideAtStake(route: Route, stake: number): number {
  if (stake <= 0) return 0;
  // An all-or-nothing contract loses the whole stake; a held asset takes a
  // drawdown scaled to its risk level rather than going to zero.
  return route.lossProfile === 'binary'
    ? stake
    : stake * route.riskLevel * DRAWDOWN_PER_RISK_LEVEL;
}

/**
 * Probability-weighted value of taking this route at `stake`:
 *   p × winProfit − (1 − p) × downside
 *
 * Near zero for a fairly-priced contract, which is the point: it shows that a
 * longshot's headline payout is not free money.
 */
export function expectedValue(route: Route, stake: number): number {
  const p = Math.min(Math.max(route.probability, 0), 100) / 100;
  return p * winProfit(route) - (1 - p) * downsideAtStake(route, stake);
}

// ── self-check ──────────────────────────────────────────────────────────────
export function __selfCheck(): void {
  const base: Omit<Route, 'id' | 'probability' | 'expectedReturn' | 'lossProfile' | 'riskLevel'> = {
    category: 'Polymarket', emoji: '🔮', description: '', platform: '', strategy: '', meetsTarget: true,
  };

  // A fairly-priced binary is worth ~nothing: 62¢ contract, $1,000 stake.
  const fair: Route = { ...base, id: 'fair', probability: 62, expectedReturn: 613, lossProfile: 'binary', riskLevel: 4 };
  const fairEv = expectedValue(fair, 1000);
  console.assert(Math.abs(fairEv) < 5, `fairly-priced 62c contract has ~zero EV, got ${fairEv}`);

  // The headline number is 53x the honest one for a 3c longshot.
  const longshot: Route = { ...base, id: 'longshot', probability: 3, expectedReturn: 32_333, lossProfile: 'binary', riskLevel: 5 };
  console.assert(Math.abs(expectedValue(longshot, 1000)) < 5, '3c longshot is also ~zero EV at fair odds');
  console.assert(winProfit(longshot) === 32_333, 'winProfit reports the unweighted payout');

  // An underpriced contract is genuinely positive; an overpriced one negative.
  const good: Route = { ...base, id: 'good', probability: 80, expectedReturn: 613, lossProfile: 'binary', riskLevel: 3 };
  console.assert(expectedValue(good, 1000) > 250, 'an 80% chance at 62c odds is clearly +EV');
  const bad: Route = { ...base, id: 'bad', probability: 20, expectedReturn: 613, lossProfile: 'binary', riskLevel: 5 };
  console.assert(expectedValue(bad, 1000) < -600, 'a 20% chance at 62c odds is clearly -EV');

  // A treasury keeps essentially all of its stated profit.
  const bill: Route = { ...base, id: 'bill', category: 'Savings & Treasuries', probability: 99, expectedReturn: 10, lossProfile: 'partial', riskLevel: 1 };
  const billEv = expectedValue(bill, 1000);
  console.assert(billEv > 9 && billEv <= 10, `treasury EV stays near its stated profit, got ${billEv}`);

  // The whole point: honest math ranks the safe route above the longshot.
  console.assert(billEv > expectedValue(longshot, 1000), 'a T-bill beats a fair-odds longshot on expected value');

  console.assert(downsideAtStake(fair, 1000) === 1000, 'binary risks the whole stake');
  console.assert(downsideAtStake(bill, 1000) === 80, 'partial risks a risk-scaled drawdown, not the stake');
  console.assert(expectedValue(fair, 0) === 0.62 * 613, 'zero stake leaves only the upside term');
}
