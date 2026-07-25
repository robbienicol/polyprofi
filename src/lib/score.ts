import type { Route } from '@/types/routes';

const GOAL_SCORE_WEIGHTS = {
  reliability: 0.35,
  principalProtection: 0.25,
  capitalEfficiency: 0.30,
  timeEfficiency: 0.10,
} as const;

export interface GoalScoreContext {
  target: number;
  requiredInvestment: number | null;
  availableInvestment: number;
  deadlineDays: number;
}

type GoalScoreCapReason = 'over_budget' | 'misses_deadline' | 'insufficient_data';

export interface GoalScoreBreakdown {
  score: number;
  rawScore: number;
  reliability: number;
  principalProtection: number;
  capitalEfficiency: number;
  timeEfficiency: number;
  contributions: {
    reliability: number;
    principalProtection: number;
    capitalEfficiency: number;
    timeEfficiency: number;
  };
  /**
   * All-or-nothing drag: for binary routes the whole score is scaled by the success
   * probability, because when a binary bet misses you don't merely miss the goal — you
   * lose the entire stake. null for capital-preserving (partial) routes, where a miss
   * still leaves you holding the asset.
  */
  allOrNothingFactor: number | null;
  marketQualityAdjustment: {
    executionScore: number | null;
    stabilityScore: number | null;
    factor: number;
    deduction: number;
  } | null;
  cap: number | null;
  capReason: GoalScoreCapReason | null;
}

/**
 * Goal Effectiveness Score (0-100).
 *
 * The four components answer separate questions:
 *   35% reliability          - how likely is the route to hit the profit goal?
 *   25% principal protection - how protected is the original investment?
 *   30% capital efficiency   - how little capital is needed for the same goal?
 *   10% time efficiency      - how early does it mature inside the deadline?
 *
 * Affordability and deadline misses are gates. They cap the final number instead
 * of becoming more weights that a high probability could average away.
 *
 * All-or-nothing routes get one extra correction: the score is scaled by the success
 * probability. The four components measure how good the route is *when it works*, but a
 * binary bet that misses loses the whole stake — so a 60%-likely lottery ticket shouldn't
 * out-rank a capital-safe stock just because it needs little money and resolves fast.
 * Probability deliberately matters twice for binary routes (once as reliability, once as
 * this survival scale) precisely because the downside is catastrophic; capital-preserving
 * routes are untouched, since a miss there still leaves you holding the asset.
 *
 * Live Polymarket routes can receive two bounded market-quality deductions. Execution
 * quality contributes up to 10%, and price stability contributes up to 5%. These inputs
 * never manufacture an informational edge: a perfect market keeps the theoretical score,
 * while a wide, thin, or violently repricing market loses confidence.
 */
export function goalEffectivenessScore(route: Route, context: GoalScoreContext): GoalScoreBreakdown {
  const reliability = clamp(route.probability, 0, 100);

  // A binary route has no downside protection: if it fails, the stake is gone.
  // Its probability already gives it credit for how likely success is, so using
  // probability again inside this component would count the same fact twice.
  const riskSafety = ((6 - clampRisk(route.riskLevel)) / 5) * 100;
  const principalProtection = route.lossProfile === 'binary' ? 0 : riskSafety;

  const validTarget = Number.isFinite(context.target) && context.target > 0;
  const validRequiredInvestment = context.requiredInvestment != null
    && Number.isFinite(context.requiredInvestment)
    && context.requiredInvestment > 0;
  const requiredInvestment = context.requiredInvestment ?? 0;
  const capitalEfficiency = validTarget && validRequiredInvestment
    ? 100 * context.target / (context.target + requiredInvestment)
    : 0;

  const deadlineDays = Number.isFinite(context.deadlineDays) && context.deadlineDays > 0
    ? context.deadlineDays
    : 1;
  const maturityDays = route.maturesInDays != null && route.maturesInDays > 0
    ? route.maturesInDays
    : deadlineDays;
  const timeEfficiency = maturityDays > deadlineDays
    ? 0
    : clamp(100 - 50 * (maturityDays / deadlineDays), 50, 100);

  const contributions = {
    reliability: round1(reliability * GOAL_SCORE_WEIGHTS.reliability),
    principalProtection: round1(principalProtection * GOAL_SCORE_WEIGHTS.principalProtection),
    capitalEfficiency: round1(capitalEfficiency * GOAL_SCORE_WEIGHTS.capitalEfficiency),
    timeEfficiency: round1(timeEfficiency * GOAL_SCORE_WEIGHTS.timeEfficiency),
  };
  const rawScore = round1(
    contributions.reliability
    + contributions.principalProtection
    + contributions.capitalEfficiency
    + contributions.timeEfficiency
  );

  // All-or-nothing drag: scale the whole score by survival probability for binary routes.
  const allOrNothingFactor = route.lossProfile === 'binary' ? clamp(reliability / 100, 0, 1) : null;
  const draggedScore = allOrNothingFactor == null ? rawScore : round1(rawScore * allOrNothingFactor);
  const marketQualityAdjustment = polymarketMarketQualityAdjustment(route, draggedScore);
  const qualityAdjustedScore = marketQualityAdjustment == null
    ? draggedScore
    : round1(draggedScore * marketQualityAdjustment.factor);

  let cap: number | null = null;
  let capReason: GoalScoreCapReason | null = null;
  if (maturityDays > deadlineDays) {
    cap = 39;
    capReason = 'misses_deadline';
  } else if (!validTarget || !validRequiredInvestment) {
    cap = 49;
    capReason = 'insufficient_data';
  } else if (
    !Number.isFinite(context.availableInvestment)
    || context.availableInvestment <= 0
    || requiredInvestment > context.availableInvestment
  ) {
    cap = 49;
    capReason = 'over_budget';
  }

  return {
    score: Math.round(clamp(cap == null ? qualityAdjustedScore : Math.min(qualityAdjustedScore, cap), 0, 100)),
    rawScore,
    reliability: round1(reliability),
    principalProtection: round1(principalProtection),
    capitalEfficiency: round1(capitalEfficiency),
    timeEfficiency: round1(timeEfficiency),
    contributions,
    allOrNothingFactor,
    marketQualityAdjustment,
    cap,
    capReason,
  };
}

function polymarketMarketQualityAdjustment(
  route: Route,
  scoreBeforeQuality: number
): GoalScoreBreakdown['marketQualityAdjustment'] {
  const executionScore = finiteScore(route.marketQuality?.executionScore);
  const stabilityScore = finiteScore(route.marketQuality?.stabilityScore);
  if (executionScore == null && stabilityScore == null) return null;

  let factor = 1;
  if (executionScore != null) factor -= 0.10 * (1 - executionScore / 100);
  if (stabilityScore != null) factor -= 0.05 * (1 - stabilityScore / 100);
  factor = Math.round(clamp(factor, 0.85, 1) * 1000) / 1000;

  return {
    executionScore,
    stabilityScore,
    factor,
    deduction: round1(scoreBeforeQuality - scoreBeforeQuality * factor),
  };
}

function finiteScore(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? clamp(value, 0, 100)
    : null;
}

export function sortByPolyProfitScore(
  routes: Route[],
  contextForRoute: (route: Route) => GoalScoreContext
): Route[] {
  const breakdowns = new Map(
    routes.map((route) => [route, goalEffectivenessScore(route, contextForRoute(route))] as const)
  );

  return [...routes].sort((a, b) => {
    const aBreakdown = breakdowns.get(a)!;
    const bBreakdown = breakdowns.get(b)!;
    const scoreDelta = bBreakdown.score - aBreakdown.score;
    if (scoreDelta !== 0) return scoreDelta;

    const marketQualityDelta =
      (bBreakdown.marketQualityAdjustment?.factor ?? 1)
      - (aBreakdown.marketQualityAdjustment?.factor ?? 1);
    if (marketQualityDelta !== 0) return marketQualityDelta;

    const capitalDelta = bBreakdown.capitalEfficiency - aBreakdown.capitalEfficiency;
    if (capitalDelta !== 0) return capitalDelta;

    const protectionDelta = bBreakdown.principalProtection - aBreakdown.principalProtection;
    if (protectionDelta !== 0) return protectionDelta;

    return bBreakdown.reliability - aBreakdown.reliability;
  });
}

export function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Strong';
  if (score >= 50) return 'Solid';
  if (score >= 40) return 'Weak';
  return 'Not viable';
}

export function scoreColor(score: number): string {
  if (score >= 80) return '#22C55E';
  if (score >= 65) return '#84CC16';
  if (score >= 50) return '#F59E0B';
  if (score >= 40) return '#F97316';
  return '#EF4444';
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function clampRisk(riskLevel: number): number {
  return clamp(Math.round(riskLevel) || 3, 1, 5);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

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

  const overBudget = goalEffectivenessScore(mk({}), context(3000, 1000));
  invariant(overBudget.score === 49 && overBudget.capReason === 'over_budget', 'over-budget route must cap at 49');

  const late = goalEffectivenessScore(mk({ maturesInDays: 31 }), context(1000));
  invariant(late.score === 39 && late.capReason === 'misses_deadline', 'late route must cap at 39');

  const binary = goalEffectivenessScore(mk({ lossProfile: 'binary' }), context(1000));
  invariant(binary.principalProtection === 0, 'binary route must get no principal-protection credit');
  invariant(binary.allOrNothingFactor === 1, 'a certain (100%) binary route is not dragged');

  // All-or-nothing drag: a coin-flip binary bet must score below a capital-safe route with
  // the same probability — losing the whole stake half the time is not "goal effectiveness".
  const binaryCoinflip = goalEffectivenessScore(mk({ lossProfile: 'binary', probability: 50 }), context(1000));
  const safeCoinflip = goalEffectivenessScore(mk({ lossProfile: 'partial', probability: 50, riskLevel: 3 }), context(1000));
  invariant(binaryCoinflip.allOrNothingFactor === 0.5, 'binary drag equals success probability');
  invariant(binaryCoinflip.score < safeCoinflip.score, 'all-or-nothing coin flip must score below a capital-safe equivalent');
  // A near-certain binary bet keeps most of its score — the drag is proportional, not a flat cap.
  const binaryLikely = goalEffectivenessScore(mk({ lossProfile: 'binary', probability: 95 }), context(1000));
  invariant(binaryLikely.score > binaryCoinflip.score, 'higher-probability binary routes are dragged less');

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

  const sorted = sortByPolyProfitScore(
    [mk({ id: 'expensive' }), mk({ id: 'efficient' })],
    (route) => context(route.id === 'efficient' ? 1000 : 3000)
  );
  invariant(sorted[0]?.id === 'efficient', 'capital-efficient route must sort first');
}

function invariant(condition: boolean, message: string): void {
  if (!condition) throw new Error(`[score self-check] ${message}`);
}
