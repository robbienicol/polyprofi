import { Route } from '@/types/routes';
import { parseEntryPrice } from '@/lib/parse-bet-line';
import { projectedProfitFromAnnualYield } from '@/lib/factual-route-data';

/**
 * New app model: the goal is a fixed TARGET ($ to make) + timeframe. The results
 * screen has an "amount to invest" slider. Each avenue was generated at a reference
 * stake; here we recover its native rate and recompute what it yields at the user's
 * chosen stake, then HIDE avenues that can't reach the target (product decision).
 *
 * Native rate recovery (rate is stake-invariant, so any nonzero reference works):
 *   bracketed → the exit plan's own winReturnRate: it is closed at the take-profit,
 *               never at resolution, whatever its loss profile.
 *   binary    → decimal odds, from the exact entryPrice, else the line ("Yes 62¢" →
 *               1/0.62), else derived from generation: 1 + expectedReturn/refStake.
 *   partial   → return fraction over the timeframe: expectedReturn/refStake.
 */

function decimalOddsFor(route: Route, refStake: number): number {
  // The exact price first, then the line. The line is rounded to the cent for display,
  // and reading the payout back out of that rounding is worst exactly where the money
  // is thinnest: a contract at 97.56¢ pays +$25 per $1,000, but "98¢" reads as +$20.
  const price = route.entryPrice ?? parseEntryPrice(route.line); // 0–1 contract price, if present
  if (price && price > 0 && price < 1) return 1 / price;
  if (refStake > 0 && route.expectedReturn > 0) return 1 + route.expectedReturn / refStake;
  return route.probability > 0 ? 100 / route.probability : 2; // fair-odds fallback
}

/**
 * Term implied by the yield's own label ("13-week T-bill" → 91 days).
 *
 * Skipped when the yield is a proxy: a savings account quoted off the "4-week T-bill"
 * yield borrows the rate, not the term. Reading 4 weeks there would give the most
 * liquid product in the app a maturity it does not have — and then report it as
 * missing the user's deadline when the money is withdrawable the same day.
 */
function sourcedYieldDays(route: Route): number | null {
  const label = route.investmentFacts?.yieldLabel ?? '';
  const isProxy = route.investmentFacts?.yieldIsEstimate === true || /proxy|not a live/i.test(label);
  if (!isProxy) {
    const weekMatch = label.match(/(\d+)[-\s]?week/i);
    if (weekMatch?.[1]) return Number(weekMatch[1]) * 7;
  }
  return route.maturesInDays ?? null;
}

function maturityLabel(days: number): string {
  if (days < 14) return `${days}d`;
  if (days < 60) return `${Math.round(days / 7)}w`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

function returnAtStake(route: Route, refStake: number, stake: number): number {
  const sourcedYield = route.investmentFacts?.yieldPct;
  const days = sourcedYieldDays(route);
  if (sourcedYield != null && days != null) {
    return projectedProfitFromAnnualYield(stake, sourcedYield, days);
  }
  // A bracketed position is closed at its take-profit, not at resolution, so its payout
  // is the plan's own rate. Without this a thin-book bracket — which is `binary`, since
  // the stop cannot be relied on — was priced as if it paid out at $1: a 52.5¢ entry
  // read as +90% when the plan's sell level pays +57%.
  if (route.exitPlan != null) {
    return stake * route.exitPlan.winReturnRate;
  }
  if (route.lossProfile === 'binary') {
    return stake * (decimalOddsFor(route, refStake) - 1);
  }
  const rate = refStake > 0 ? route.expectedReturn / refStake : 0;
  return stake * rate;
}

export function stakeNeededForReturn(route: Route, refStake: number, target: number): number | null {
  if (target <= 0) return null;
  const profitAtReferenceStake = returnAtStake(route, refStake, refStake);
  if (profitAtReferenceStake <= 0) return null;
  return Math.ceil((target / profitAtReferenceStake) * refStake);
}

/**
 * Rescale every route to `stake` and mark whether it can hit `target`.
 * The broader opportunity explorer keeps near-misses visible so users can
 * compare safe, balanced, and long-shot avenues in one pool.
 */
export function rescoreForStake(
  routes: Route[],
  refStake: number,
  stake: number,
  target: number
): Route[] {
  return routes.map((r) => {
    const expectedReturn = Math.round(returnAtStake(r, refStake, stake));
    const sourcedYield = r.investmentFacts?.yieldPct;
    const sourcedDays = sourcedYieldDays(r);
    if (sourcedYield != null && sourcedDays != null) {
      // Strip whatever lead-in the source route used, or the rewrite below stacks a
      // second one on top: "Put your $1,000 in Park your $1,000 in a savings account".
      const instrument = r.description
        .split('—')[0]
        ?.replace(/^(buy a|buy|put|park|place|move)\s+(your\s+)?(\$[\d,]+\s+)?(in|into|on)?\s*/i, '')
        .trim() || r.category;
      const yieldLabel = r.investmentFacts?.yieldLabel ?? 'sourced yield';
      return {
        ...r,
        description: `Put your $${stake.toLocaleString()} in ${instrument} — ${sourcedYield.toFixed(2)}% ${yieldLabel} projects +$${expectedReturn} over ${maturityLabel(sourcedDays)}.`,
        expectedReturn,
        maturesInDays: sourcedDays,
        meetsTarget: expectedReturn >= target,
        investmentFacts: {
          ...r.investmentFacts,
          projectedProfit: expectedReturn,
          projectionBasis: `$${stake.toLocaleString()} × ${sourcedYield.toFixed(2)}% annual yield × ${sourcedDays}/365 days`,
        },
      };
    }
    return { ...r, expectedReturn, meetsTarget: expectedReturn >= target };
  });
}

// ── self-check ──────────────────────────────────────────────────────────────
export function __selfCheck(): void {
  const bin: Route = {
    id: '1', category: 'Polymarket', emoji: '', description: '', riskLevel: 2,
    probability: 62, expectedReturn: 61, platform: '', strategy: '', line: 'Yes 62¢',
    lossProfile: 'binary', meetsTarget: true,
  };
  // 62¢ → decimal 1.613; $100 stake → ~$61 profit
  console.assert(Math.round(returnAtStake(bin, 100, 100)) === 61, 'binary from line price');
  console.assert(Math.round(returnAtStake(bin, 100, 200)) === 123, 'binary scales with stake');

  // The line is rounded for display; the payout must come off the real price. At 97.56¢
  // a $1,000 stake pays +$25, and "98¢" would have said +$20.
  const precise: Route = { ...bin, id: '1b', probability: 98, line: 'No 98¢', entryPrice: 0.9756 };
  console.assert(Math.round(returnAtStake(precise, 1000, 1000)) === 25, 'payout uses the exact price, not the rounded line');
  console.assert(
    Math.round(returnAtStake({ ...precise, entryPrice: undefined }, 1000, 1000)) === 20,
    'without an exact price it still falls back to the line',
  );

  // A bracket is closed at its take-profit. Priced as if it paid out at resolution, a
  // 52.5¢ entry reads +90% where the plan pays +57% — and a thin book makes that route
  // binary, so the loss profile cannot be what decides this.
  const bracketed: Route = {
    ...bin, id: '1c', line: 'No 52.5¢ → 83.8¢', entryPrice: 0.525,
    exitPlan: { kind: 'bracket', winReturnRate: 0.572 } as Route['exitPlan'],
  };
  console.assert(Math.round(returnAtStake(bracketed, 1000, 1000)) === 572, 'a bracket pays its plan rate, not resolution odds');
  console.assert(
    Math.round(returnAtStake({ ...bracketed, lossProfile: 'partial' }, 1000, 1000)) === 572,
    'the same is true whichever loss profile the bracket carries',
  );

  const part: Route = {
    id: '2', category: 'Stocks & ETFs', emoji: '', description: '', riskLevel: 1,
    probability: 90, expectedReturn: 8, platform: '', strategy: '',
    lossProfile: 'partial', meetsTarget: true,
  };
  // 8% return at ref $100 → $16 at $200
  console.assert(Math.round(returnAtStake(part, 100, 200)) === 16, 'partial scales with stake');

  const misses = rescoreForStake([part], 100, 50, 100);
  console.assert(misses.length === 1 && !misses[0].meetsTarget, 'near-miss stays visible and is marked under target');
  const hits = rescoreForStake([part], 100, 2000, 100);
  console.assert(hits.length === 1 && hits[0].meetsTarget, 'route is marked as meeting the target once stake is sufficient');
  console.assert(stakeNeededForReturn(part, 100, 100) === 1250, '$8 per $100 needs $1,250 to make $100');

  // ── sourced-yield instruments ─────────────────────────────────────────────
  const bill: Route = {
    id: '3', category: 'Savings & Treasuries', emoji: '🏦',
    description: 'Buy a 13-week T-bill — 4.20% sourced yield projects +$10 in 3mo.',
    riskLevel: 1, probability: 99, expectedReturn: 10, platform: '', strategy: '',
    lossProfile: 'partial', meetsTarget: false, maturesInDays: 91,
    investmentFacts: { yieldPct: 4.2, yieldLabel: '13-week T-bill coupon-equivalent yield' },
  };
  const billRescored = rescoreForStake([bill], 1000, 1000, 100)[0];
  console.assert(billRescored.maturesInDays === 91, 'a real bill takes its term from its own label');
  console.assert(
    !/put your \$[\d,]+ in (buy|put|park)/i.test(billRescored.description),
    'the rewritten description does not stack a second lead-in',
  );

  // A proxy borrows the rate, not the term: an HYSA quoted off the 4-week bill is
  // still withdrawable the same day, and must not inherit a 28-day maturity.
  const hysa: Route = {
    ...bill,
    id: '4',
    description: 'Park your $1,000 in a high-yield online savings account — top HYSAs track the 4-week T-bill.',
    maturesInDays: 7,
    investmentFacts: {
      yieldPct: 4.6,
      yieldLabel: 'Proxy: 4-week T-bill yield (not a live bank quote)',
      yieldIsEstimate: true,
    },
  };
  const hysaRescored = rescoreForStake([hysa], 1000, 1000, 100)[0];
  console.assert(
    hysaRescored.maturesInDays === 7,
    'a proxy yield does not hand its source instrument\'s term to the route',
  );
  console.assert(
    hysaRescored.description.startsWith('Put your $1,000 in a high-yield online savings account'),
    'the lead-in is replaced rather than doubled for a "Park your $X in" description',
  );
}
