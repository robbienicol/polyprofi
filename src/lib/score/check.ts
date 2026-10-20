import {
  goalEffectivenessScore,
  sortByPatheyScore,
  type GoalScoreContext,
} from '@/lib/score/goal-score';
import { DEFAULT_SCORE_WEIGHTS, normalizeScoreWeights } from '@/lib/score/weights';
import type { Route } from '@/types/routes';

// Focused numerical checks. These are exported so they can be run without a
// test framework in this Expo project.
export function __selfCheck(): void {
  const mk = (over: Partial<Route>): Route => ({
    id: '1', category: '', emoji: '', description: '', riskLevel: 1, probability: 100,
    expectedReturn: 1000, platform: '', strategy: '', lossProfile: 'partial', meetsTarget: true,
    maturesInDays: 15, ...over,
  });
  const context = (requiredInvestment: number, availableInvestment = 5000): GoalScoreContext => ({
    target: 1000,
    requiredInvestment,
    availableInvestment,
    deadlineDays: 30,
  });
  const efficient = goalEffectivenessScore(mk({ id: 'efficient' }), context(1000));
  const expensive = goalEffectivenessScore(mk({ id: 'expensive' }), context(3000));
  invariant(efficient.score === 83, `$1k route should score 83, got ${efficient.score}`);
  invariant(expensive.score === 75, `$3k route should score 75, got ${expensive.score}`);
  invariant(efficient.capitalEfficiency === 50, 'capital score should be 50 when stake equals goal');
  invariant(expensive.capitalEfficiency === 25, 'capital score should be 25 when stake is 3x goal');
  invariant(efficient.score > expensive.score, 'less capital must win when every other input matches');

  // A route that genuinely needs no capital (a spending cut) must read as maximally
  // capital-efficient and never get caught by the "we don't know" cap.
  const noCapital = goalEffectivenessScore(mk({ id: 'no-capital' }), context(0));
  invariant(noCapital.capitalEfficiency === 100, `zero-cost route should be 100% capital-efficient, got ${noCapital.capitalEfficiency}`);
  invariant(noCapital.capReason !== 'insufficient_data', 'a known $0 cost is not missing data');
  invariant(noCapital.capReason !== 'over_budget', '$0 can never be over budget');

  const overBudget = goalEffectivenessScore(mk({}), context(3000, 1000));
  invariant(overBudget.score === 49 && overBudget.capReason === 'over_budget', 'over-budget route must cap at 49');

  const late = goalEffectivenessScore(mk({ maturesInDays: 31 }), context(1000));
  invariant(late.score === 39 && late.capReason === 'misses_deadline', 'late route must cap at 39');

  const binary = goalEffectivenessScore(mk({ lossProfile: 'binary' }), context(1000));
  invariant(binary.principalProtection === 0, 'binary route must get no principal-protection credit');
  invariant(binary.lossFraction === 1, 'a binary route loses the whole stake on a miss');
  invariant(binary.capitalSurvivalFactor === 1, 'a certain (100%) binary route is not dragged');

  // Capital-destruction drag: a coin-flip binary bet must score below a capital-preservation route
  // with the same probability — losing the whole stake half the time is not "goal effectiveness".
  const binaryCoinflip = goalEffectivenessScore(mk({ lossProfile: 'binary', probability: 50 }), context(1000));
  const safeCoinflip = goalEffectivenessScore(mk({ lossProfile: 'partial', probability: 50, riskLevel: 3 }), context(1000));
  invariant(binaryCoinflip.capitalSurvivalFactor === 0.5, 'a total-loss route drags by exactly the success probability');
  invariant(binaryCoinflip.score < safeCoinflip.score, 'all-or-nothing coin flip must score below a capital-preservation equivalent');
  // A near-certain binary bet keeps most of its score — the drag is proportional, not a flat cap.
  const binaryLikely = goalEffectivenessScore(mk({ lossProfile: 'binary', probability: 95 }), context(1000));
  invariant(binaryLikely.score > binaryCoinflip.score, 'higher-probability binary routes are dragged less');

  // The prediction-market question this generalisation exists to answer. Same contract,
  // same coin-flip odds; the ONLY difference is that a stop caps the loss at 20% of stake.
  // The bracketed route must score higher — and it must be the stop earning it, not the
  // volatility, which is exactly zero-EV (see @/lib/prediction-swing).
  const bracketPlan = {
    kind: 'bracket' as const,
    entryCents: 40, netEntryCents: 40.5, takeProfitCents: 55, stopCents: 32,
    roundTripCostCents: 1, barrierProbability: 34.8, breakevenProbability: 39.1,
    costEdgePts: -4.3, expectedExitDays: 12, resolvesInTimeProbability: 92,
    successProbability: 32, plannedLossFraction: 0.2, effectiveLossFraction: 0.2,
    winReturnRate: 0.35,
  };
  const bracketed = goalEffectivenessScore(
    mk({ lossProfile: 'partial', probability: 50, riskLevel: 3, exitPlan: bracketPlan }),
    context(1000),
  );
  invariant(bracketed.lossFraction === 0.2, 'a bracketed route reports the loss its stop leaves at risk');
  invariant(bracketed.principalProtection === 80, 'a 20% stop protects 80% of the principal');
  invariant(bracketed.capitalSurvivalFactor === 0.9, 'survival = 0.5 + 0.5×0.8');
  invariant(bracketed.score > binaryCoinflip.score, 'a stop that caps the loss must beat the same bet held all-or-nothing');

  // …and a stop the book is too thin to honour earns almost none of that credit.
  const gapped = goalEffectivenessScore(
    mk({
      lossProfile: 'partial', probability: 50, riskLevel: 3,
      exitPlan: { ...bracketPlan, effectiveLossFraction: 0.9 },
    }),
    context(1000),
  );
  invariant(gapped.score < bracketed.score, 'an unfillable stop must not be credited as protection');

  const liquidBinary = goalEffectivenessScore(mk({
    lossProfile: 'binary',
    probability: 70,
    marketQuality: {
      executionScore: 100,
      stabilityScore: 100,
      liquidityUsd: 100_000,
      pricePosition: 'middle',
    },
  }), context(1000));
  const thinVolatileBinary = goalEffectivenessScore(mk({
    lossProfile: 'binary',
    probability: 70,
    marketQuality: {
      executionScore: 20,
      stabilityScore: 20,
      liquidityUsd: 500,
      pricePosition: 'near_recent_high',
    },
  }), context(1000));
  invariant(liquidBinary.marketQualityAdjustment?.factor === 1, 'perfect market quality should not change the score');
  invariant(thinVolatileBinary.marketQualityAdjustment?.factor === 0.88, 'poor execution and stability should apply the bounded deduction');
  invariant(thinVolatileBinary.score < liquidBinary.score, 'thin, volatile market should rank below an otherwise identical liquid market');

  const sorted = sortByPatheyScore(
    [mk({ id: 'expensive' }), mk({ id: 'efficient' })],
    (route) => context(route.id === 'efficient' ? 1000 : 3000)
  );
  invariant(sorted[0]?.id === 'efficient', 'capital-efficient route must sort first');

  // ── user-set weights ──────────────────────────────────────────────────────
  // Raw slider importance, not fractions: only the ratios count, so the score
  // stays on its 0-100 scale wherever the sliders are left.
  const allTop = normalizeScoreWeights({ reliability: 100, principalProtection: 100, capitalEfficiency: 100, timeEfficiency: 100 });
  const allMiddle = normalizeScoreWeights({ reliability: 50, principalProtection: 50, capitalEfficiency: 50, timeEfficiency: 50 });
  invariant(allTop.reliability === 0.25, 'four equal sliders each carry a quarter, wherever they sit');
  invariant(allTop.reliability === allMiddle.reliability, 'raising every slider asks for nothing — only ratios count');
  invariant(
    normalizeScoreWeights({ reliability: 0, principalProtection: 0, capitalEfficiency: 0, timeEfficiency: 0 }) === DEFAULT_SCORE_WEIGHTS,
    'a set of all zeros carries no preference, so the defaults stand',
  );
  const negative = normalizeScoreWeights({ reliability: -5, principalProtection: 5, capitalEfficiency: 0, timeEfficiency: 0 });
  invariant(negative.principalProtection === 1, 'a negative slider counts as zero rather than inverting the component');

  // Weights must actually move the ranking: same two routes, opposite priorities.
  const safeSlow = mk({ id: 'safeSlow', lossProfile: 'partial', riskLevel: 1, probability: 55, maturesInDays: 29 });
  const riskyFast = mk({ id: 'riskyFast', lossProfile: 'binary', riskLevel: 4, probability: 55, maturesInDays: 2 });
  const protectionFirst = sortByPatheyScore([riskyFast, safeSlow], () => context(1000), {
    reliability: 0, principalProtection: 100, capitalEfficiency: 0, timeEfficiency: 0,
  });
  const speedFirst = sortByPatheyScore([safeSlow, riskyFast], () => context(1000), {
    reliability: 0, principalProtection: 0, capitalEfficiency: 0, timeEfficiency: 100,
  });
  invariant(protectionFirst[0].id === 'safeSlow', 'all-in on protecting the stake ranks the capital-safe route first');
  invariant(speedFirst[0].id === 'riskyFast', 'all-in on speed ranks the fastest route first');

  // A slider cannot spend its way past a gate: the corrections are not weights.
  const cappedByWeights = goalEffectivenessScore(mk({ maturesInDays: 31 }), context(1000), {
    reliability: 100, principalProtection: 0, capitalEfficiency: 0, timeEfficiency: 0,
  });
  invariant(cappedByWeights.score === 39, 'no weighting lifts a route that misses the deadline past its cap');
  invariant(
    goalEffectivenessScore(mk({}), context(1000), allTop).weights.timeEfficiency === 0.25,
    'the breakdown reports the normalised weights it was scored with',
  );
}

function invariant(condition: boolean, message: string): void {
  if (!condition) throw new Error(`[score self-check] ${message}`);
}
