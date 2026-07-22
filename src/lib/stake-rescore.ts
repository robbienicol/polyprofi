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
 *   binary  → decimal odds. Prefer the live line price ("Yes 62¢" → 1/0.62);
 *             else derive from generation: 1 + expectedReturn/refStake.
 *   partial → return fraction over the timeframe: expectedReturn/refStake.
 */

function decimalOddsFor(route: Route, refStake: number): number {
  const price = parseEntryPrice(route.line); // 0–1 contract price, if present
  if (price && price > 0 && price < 1) return 1 / price;
  if (refStake > 0 && route.expectedReturn > 0) return 1 + route.expectedReturn / refStake;
  return route.probability > 0 ? 100 / route.probability : 2; // fair-odds fallback
}

function sourcedYieldDays(route: Route): number | null {
  const label = route.investmentFacts?.yieldLabel ?? '';
  const weekMatch = label.match(/(\d+)[-\s]?week/i);
  if (weekMatch?.[1]) return Number(weekMatch[1]) * 7;
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
      const instrument = r.description.split('—')[0]?.replace(/^Buy a\s+/i, '').replace(/^Put your \$[\d,]+ in\s+/i, '').trim() || r.category;
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
}
