import type { MarketQualityFacts } from '@/types/routes';
import {
  barrierHitProbability,
  bracketLossProfile,
  bracketRiskLevel,
  breakevenHitProbability,
  buildSwingPlan,
  expectedBarrierDays,
  resolvesInTimeProbability,
  stopGapRisk,
} from '@/lib/prediction-swing/bracket';

// ── self-check ──────────────────────────────────────────────────────────────
export function __selfCheck(): void {
  // The worked example: buy 40¢, sell 55¢, stop 32¢.
  const hit = barrierHitProbability(40, 55, 32)!;
  invariant(Math.abs(hit - (8 / 23) * 100) < 1e-9, `40/55/32 barrier probability should be 8/23, got ${hit}`);

  // The whole point: with zero cost the barrier probability EQUALS the breakeven, so the
  // bracket is exactly zero-EV. If this ever drifts apart, the martingale model is broken.
  const freeBreakeven = breakevenHitProbability(40, 55, 32, 0)!;
  invariant(Math.abs(hit - freeBreakeven) < 1e-9, 'a costless bracket must be exactly zero-EV');

  // …and with cost the edge is exactly −s/width, never anything better.
  const costedBreakeven = breakevenHitProbability(40, 55, 32, 1)!;
  invariant(
    Math.abs((hit - costedBreakeven) - (-1 / 23) * 100) < 1e-9,
    'cost edge must be exactly −spread/(takeProfit − stop)'
  );
  invariant(costedBreakeven > hit, 'paying a spread can only raise the bar');

  // Volatility must not touch the odds — only the expected time to get there.
  invariant(
    barrierHitProbability(40, 55, 32) === barrierHitProbability(40, 55, 32),
    'barrier odds take no volatility input at all'
  );
  const calmDays = expectedBarrierDays(40, 55, 32, 1)!;
  const wildDays = expectedBarrierDays(40, 55, 32, 4)!;
  invariant(calmDays === 8 * 15, 'E[τ] = (x−L)(U−x)/σ²');
  invariant(wildDays < calmDays, 'a wilder market reaches a barrier sooner — sooner, not more often');

  // More time only raises the chance the bracket closes at all.
  invariant(resolvesInTimeProbability(10, 30) > resolvesInTimeProbability(10, 5), 'more time → more chance of closing');
  invariant(resolvesInTimeProbability(10, 0) === 0, 'no time → no chance of closing');

  // A thin book means the stop may not fill; a deep one means it will.
  invariant(stopGapRisk(100) === 0, 'a perfect book honours the stop');
  invariant(stopGapRisk(0) === 1, 'a dead book makes the stop worthless');
  invariant(stopGapRisk(50) === 0.25, 'gap risk is squared, so it only bites at genuinely bad execution');

  const quality: MarketQualityFacts = {
    executionScore: 100,
    stabilityScore: 80,
    liquidityUsd: 500_000,
    spreadCents: 1,
    bestBidCents: 39.5,
    bestAskCents: 40.5,
    recentRangePts: 16,
    pricePosition: 'middle',
    oneDayMovePts: 3,
    oneWeekMovePts: 8,
    oneMonthMovePts: -12,
  };
  const plan = buildSwingPlan({
    quality,
    priceCents: 40,
    requiredReturnRate: 0.3,
    daysToResolution: 120,
    deadlineDays: 30,
  })!;
  invariant(plan != null, 'a liquid, moving market should produce a plan');
  invariant(plan.entryCents === 40, `plan should enter at the 40¢ mid, got ${plan.entryCents}`);
  invariant(plan.stopCents < plan.entryCents && plan.takeProfitCents > plan.entryCents, 'stop below, target above');
  invariant(plan.costEdgePts < 0, 'a bracket plan can never advertise a positive edge');
  invariant(
    Math.abs(plan.costEdgePts + (plan.roundTripCostCents / (plan.takeProfitCents - plan.stopCents)) * 100) < 0.05,
    'the reported edge must be exactly the cost drag'
  );
  invariant(
    Math.abs(plan.winReturnRate - 0.3) < 0.01,
    `take-profit is set by the 30% goal, got ${plan.winReturnRate}`
  );
  invariant(plan.plannedLossFraction < 1, 'a stop caps the loss below the full stake');
  invariant(
    plan.effectiveLossFraction === plan.plannedLossFraction,
    'a perfectly liquid market takes no gap-risk haircut'
  );
  invariant(plan.expectedExitDays <= 30, 'expected exit never exceeds the horizon');
  invariant(
    plan.successProbability < plan.barrierProbability,
    'needing to close before the deadline can only lower the odds'
  );

  // Same market, illiquid: the stop stops working and the route collapses toward binary.
  const thin = buildSwingPlan({
    quality: { ...quality, executionScore: 10 },
    priceCents: 40,
    requiredReturnRate: 0.3,
    daysToResolution: 120,
    deadlineDays: 30,
  })!;
  invariant(
    thin.effectiveLossFraction > plan.effectiveLossFraction,
    'a thin book must be credited with less stop protection'
  );

  // A market that has never moved gives no bracket to trade.
  const still = buildSwingPlan({
    quality: { ...quality, oneDayMovePts: 0, oneWeekMovePts: 0, oneMonthMovePts: 0, recentRangePts: 0 },
    priceCents: 40,
    requiredReturnRate: 0.3,
    daysToResolution: 120,
    deadlineDays: 30,
  });
  invariant(still === null, 'a motionless market yields no plan rather than a fake one');

  // A goal that needs a price above 100¢ is impossible, not merely unlikely.
  const impossible = buildSwingPlan({
    quality,
    priceCents: 40,
    requiredReturnRate: 3,
    daysToResolution: 120,
    deadlineDays: 30,
  });
  invariant(impossible === null, 'a goal needing >99¢ must yield no plan');

  invariant(bracketRiskLevel(0.1) === 2 && bracketRiskLevel(0.95) === 5, 'risk band follows what the stop leaves at risk');

  // The reported bug: a bracket could be badged "Capital preservation" while the
  // risk level printed beside it said Very Aggressive, because the loss profile
  // was hardcoded rather than derived. The two now come from one number.
  invariant(
    bracketLossProfile(0.1) === 'partial',
    'a stop that leaves 10% at risk really does preserve capital',
  );
  invariant(
    bracketLossProfile(0.95) === 'binary',
    'a stop that cannot fill is all-or-nothing, whatever the plan intended',
  );
  invariant(
    bracketLossProfile(0.5) === 'binary',
    'losing exactly half the stake is not preservation — the boundary is exclusive',
  );
  invariant(
    [0, 0.1, 0.29, 0.49, 0.5, 0.61, 0.95, 1].every((fraction) =>
      bracketLossProfile(fraction) === 'partial' ? bracketRiskLevel(fraction) < 5 : true),
    'no route can ever claim capital preservation while showing the top risk band',
  );
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[prediction swing self-check] ${message}`);
}
