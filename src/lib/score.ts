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
    score: Math.round(clamp(cap == null ? rawScore : Math.min(rawScore, cap), 0, 100)),
    rawScore,
    reliability: round1(reliability),
    principalProtection: round1(principalProtection),
    capitalEfficiency: round1(capitalEfficiency),
    timeEfficiency: round1(timeEfficiency),
    contributions,
    cap,
    capReason,
  };
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

  const sorted = sortByPolyProfitScore(
    [mk({ id: 'expensive' }), mk({ id: 'efficient' })],
    (route) => context(route.id === 'efficient' ? 1000 : 3000)
  );
  invariant(sorted[0]?.id === 'efficient', 'capital-efficient route must sort first');
}

function invariant(condition: boolean, message: string): void {
  if (!condition) throw new Error(`[score self-check] ${message}`);
}
