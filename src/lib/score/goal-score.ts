import { DEFAULT_SCORE_WEIGHTS, normalizeScoreWeights, type ScoreWeights } from '@/lib/score/weights';
import type { Route } from '@/types/routes';

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
  /** The normalised weights this score was computed with — what the sliders asked for. */
  weights: ScoreWeights;
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
   * Expected surviving capital: p + (1 − p)·(1 − lossFraction). The whole score is scaled
   * by it, because a route that destroys capital when it misses isn't merely failing to
   * hit the goal. An all-or-nothing bet (lossFraction 1) reduces to a straight ×p; a
   * bracketed position whose stop caps the loss at 20% is barely touched. null for routes
   * with no known loss fraction, where a miss still leaves you holding the asset.
   */
  capitalSurvivalFactor: number | null;
  /**
   * Fraction of the stake destroyed on failure, if known: 1 for all-or-nothing routes, the
   * gap-risk-adjusted stop distance for bracketed ones, null when only riskLevel is known.
   */
  lossFraction: number | null;
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
 * The four components answer separate questions, at the weights the user set
 * (DEFAULT_SCORE_WEIGHTS when they have not touched them):
 *   35% reliability          - how likely is the route to hit the profit goal?
 *   25% principal protection - how protected is the original investment?
 *   30% capital efficiency   - how little capital is needed for the same goal?
 *   10% time efficiency      - how early does it mature inside the deadline?
 *
 * Only the four weights are the user's to set. The gates, the capital-destruction
 * drag and the market-quality deductions below are not — they are corrections for
 * things that are true whatever someone's priorities are, so no slider can turn
 * off the fact that an unaffordable route is unaffordable.
 *
 * Affordability and deadline misses are gates. They cap the final number instead
 * of becoming more weights that a high probability could average away.
 *
 * Routes with a known loss fraction get one extra correction: the score is scaled by
 * expected surviving capital, p + (1 − p)·(1 − lossFraction). The four components measure
 * how good the route is *when it works*, but a bet that vaporises the stake when it misses
 * shouldn't out-rank a capital-preservation stock just because it needs little money and resolves
 * fast. Probability deliberately matters twice for destructive routes (once as reliability,
 * once as this survival scale) precisely because the downside is catastrophic.
 *
 * The loss fraction is what makes strategies comparable rather than the loss *label*:
 *   - all-or-nothing (a Polymarket contract held to resolution) → 1, so the scale is ×p,
 *   - a bracketed position whose stop caps the loss at 20% → 0.2, so it is barely dragged,
 *   - a route with no modelled loss fraction → untouched, and principal protection falls
 *     back to riskLevel, since a miss there still leaves you holding the asset.
 * A bracket earns that better treatment only because the stop caps the loss — never
 * because the market is volatile, which is exactly zero-EV (see @/lib/prediction-swing).
 *
 * Live Polymarket routes can receive two bounded market-quality deductions. Execution
 * quality contributes up to 10%, and price stability contributes up to 5%. These inputs
 * never manufacture an informational edge: a perfect market keeps the theoretical score,
 * while a wide, thin, or violently repricing market loses confidence.
 */
export function goalEffectivenessScore(
  route: Route,
  context: GoalScoreContext,
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS,
): GoalScoreBreakdown {
  const appliedWeights = normalizeScoreWeights(weights);
  const reliability = clamp(route.probability, 0, 100);

  // How much of the stake survives a failure. An all-or-nothing route protects nothing;
  // a bracketed one protects everything outside its stop distance. Probability already
  // gives the route credit for how likely success is, so using it again inside this
  // component would count the same fact twice.
  const lossFraction = routeLossFraction(route);
  const riskSafety = ((6 - clampRisk(route.riskLevel)) / 5) * 100;
  const principalProtection = lossFraction == null ? riskSafety : (1 - lossFraction) * 100;

  const validTarget = Number.isFinite(context.target) && context.target > 0;
  // >= 0, not > 0: a route that genuinely needs no capital (a spending cut,
  // say) is the *best* case for this component, not a missing one. `!= null`
  // already separates "known to be $0" from "never told us" below.
  const validRequiredInvestment = context.requiredInvestment != null
    && Number.isFinite(context.requiredInvestment)
    && context.requiredInvestment >= 0;
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
    reliability: round1(reliability * appliedWeights.reliability),
    principalProtection: round1(principalProtection * appliedWeights.principalProtection),
    capitalEfficiency: round1(capitalEfficiency * appliedWeights.capitalEfficiency),
    timeEfficiency: round1(timeEfficiency * appliedWeights.timeEfficiency),
  };
  const rawScore = round1(
    contributions.reliability
    + contributions.principalProtection
    + contributions.capitalEfficiency
    + contributions.timeEfficiency
  );

  // Capital-destruction drag: scale the whole score by the fraction of the stake expected
  // to survive. lossFraction 1 reduces this to the original ×probability for binary routes.
  const successOdds = clamp(reliability / 100, 0, 1);
  const capitalSurvivalFactor = lossFraction == null
    ? null
    : round3(clamp(successOdds + (1 - successOdds) * (1 - lossFraction), 0, 1));
  const draggedScore = capitalSurvivalFactor == null ? rawScore : round1(rawScore * capitalSurvivalFactor);
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
    weights: appliedWeights,
    reliability: round1(reliability),
    principalProtection: round1(principalProtection),
    capitalEfficiency: round1(capitalEfficiency),
    timeEfficiency: round1(timeEfficiency),
    contributions,
    capitalSurvivalFactor,
    lossFraction,
    marketQualityAdjustment,
    cap,
    capReason,
  };
}

/**
 * Fraction of the stake destroyed when the route fails, or null when only riskLevel is
 * known. A bracketed position states its own (already adjusted for the chance the book is
 * too thin to honour the stop); everything else falls back to the loss profile.
 */
function routeLossFraction(route: Route): number | null {
  const bracketed = route.exitPlan?.effectiveLossFraction;
  if (typeof bracketed === 'number' && Number.isFinite(bracketed)) return clamp(bracketed, 0, 1);
  return route.lossProfile === 'binary' ? 1 : null;
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

export function sortByPatheyScore(
  routes: Route[],
  contextForRoute: (route: Route) => GoalScoreContext,
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS,
): Route[] {
  const breakdowns = new Map(
    routes.map((route) => [route, goalEffectivenessScore(route, contextForRoute(route), weights)] as const)
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

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function clampRisk(riskLevel: number): number {
  return clamp(Math.round(riskLevel) || 3, 1, 5);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
