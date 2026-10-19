import { betEv } from '@/lib/portfolio';
import type { SavingsGoal, TrackedBet } from '@/types/bets';

/**
 * The shape of a portfolio, as opposed to its size: where the money can go to
 * zero, how far apart the good and bad days are, how long it is tied up, and
 * which of the routes held is doing the most work per dollar.
 *
 * All of this is modelled. `portfolio.ts` owns the expected-value maths and this
 * builds on it rather than re-deriving it, so a change to how EV is computed
 * cannot leave the two disagreeing.
 */

/** How a position can lose money, which is not the same as how much it might make. */
export type RiskShape =
  /** All or nothing: the stake is gone if it does not land. Predictions, options. */
  | 'binary'
  /** Exposed to a market, but a fall is a fall rather than a wipeout. Stocks, crypto. */
  | 'market'
  /** Principal is not exposed to market moves. Savings, Treasury, cash. */
  | 'protected';

// Matched in this order: a "Treasury options" style label is an option first.
const BINARY = /sports|polymarket|parlay|option|prediction|call|put|spread/i;
const PROTECTED = /treasur|savings|hysa|bond|\bcd\b|cash|money market/i;

export function riskShapeFor(category: string): RiskShape {
  if (BINARY.test(category)) return 'binary';
  if (PROTECTED.test(category)) return 'protected';
  return 'market';
}

/**
 * How far a market-risk position is marked down in the worst case, by the risk
 * level the route was rated at (1 safest, 5 riskiest).
 *
 * A number had to be chosen. Stocks and crypto have no "loses everything" event
 * to point at the way a prediction contract does, so a worst case that assumed
 * zero would be theatre and one that assumed no loss would be a lie. The route's
 * own risk rating is the app's existing judgement about how violently a vehicle
 * moves, so the worst case leans on that rather than inventing a second scale.
 * Stated in the metric's own explainer, because an assumption the user cannot
 * see is one they cannot disagree with.
 */
const WORST_CASE_DRAWDOWN: Record<number, number> = { 1: 0.05, 2: 0.15, 3: 0.3, 4: 0.5, 5: 0.75 };

function drawdownFraction(riskLevel: number): number {
  const clamped = Math.min(5, Math.max(1, Math.round(riskLevel || 3)));
  return WORST_CASE_DRAWDOWN[clamped];
}

export interface OutcomeRange {
  /** Principal across active positions. */
  staked: number;
  /** Holdings if every position pays what it was taken for. */
  best: number;
  /** Holdings if every position goes against you, modelled per risk shape. */
  worst: number;
  /** Holdings on an average run: staked plus expected profit. */
  expected: number;
  /** Where `expected` sits between worst and best, 0–1. 0.5 when the range is empty. */
  expectedPosition: number;
}

/**
 * The spread of outcomes, in money you would be holding rather than money made.
 * Payout terms rather than profit terms on purpose: "you could end up with
 * £2,000" is a sentence people can act on, and "you could lose £4,000" is not
 * the same claim as "your profit could be −£4,000".
 */
export function outcomeRange(bets: TrackedBet[], conservative = false): OutcomeRange {
  const active = bets.filter((bet) => bet.status === 'active');
  let staked = 0;
  let best = 0;
  let worst = 0;
  let expectedProfit = 0;

  for (const bet of active) {
    const shape = riskShapeFor(bet.category);
    staked += bet.amountWagered;
    best += bet.amountWagered + bet.expectedReturn;
    expectedProfit += betEv(bet, conservative);
    if (shape === 'binary') continue; // stake gone: contributes nothing to the worst case
    worst += shape === 'protected'
      ? bet.amountWagered
      : bet.amountWagered * (1 - drawdownFraction(bet.riskLevel));
  }

  const expected = staked + expectedProfit;
  const span = best - worst;
  return {
    staked,
    best,
    worst,
    expected,
    expectedPosition: span > 0 ? Math.min(1, Math.max(0, (expected - worst) / span)) : 0.5,
  };
}

export interface CapitalSplit {
  staked: number;
  /** Principal that can be lost outright — every binary position. */
  atRisk: number;
  /** Principal exposed to a market but not to a wipeout. */
  marketExposed: number;
  /** Principal not exposed to market moves at all. */
  protectedCapital: number;
  /** Shares of the total, 0–100, for drawing the split. */
  atRiskPct: number;
  marketExposedPct: number;
  protectedPct: number;
}

/** Where the money sits on the can-I-lose-this axis. */
export function capitalSplit(bets: TrackedBet[]): CapitalSplit {
  const active = bets.filter((bet) => bet.status === 'active');
  let atRisk = 0;
  let marketExposed = 0;
  let protectedCapital = 0;

  for (const bet of active) {
    const shape = riskShapeFor(bet.category);
    if (shape === 'binary') atRisk += bet.amountWagered;
    else if (shape === 'market') marketExposed += bet.amountWagered;
    else protectedCapital += bet.amountWagered;
  }

  const staked = atRisk + marketExposed + protectedCapital;
  const share = (part: number): number => (staked > 0 ? (part / staked) * 100 : 0);
  return {
    staked,
    atRisk,
    marketExposed,
    protectedCapital,
    atRiskPct: share(atRisk),
    marketExposedPct: share(marketExposed),
    protectedPct: share(protectedCapital),
  };
}

/**
 * Stake-weighted days left across active positions. Weighted rather than plain,
 * because a large slow position ties up the portfolio in a way a small fast one
 * does not, and an unweighted average hides exactly that.
 *
 * Positions with no recorded maturity are left out entirely instead of counted
 * as zero, which would drag the average toward "finishes today".
 */
export function averageDaysToMaturity(bets: TrackedBet[]): number | null {
  const dated = bets.filter((bet) => bet.status === 'active' && (bet.maturesInDays ?? 0) > 0);
  const weight = dated.reduce((sum, bet) => sum + bet.amountWagered, 0);
  if (dated.length === 0 || weight <= 0) return null;
  return dated.reduce((sum, bet) => sum + (bet.maturesInDays as number) * bet.amountWagered, 0) / weight;
}

export interface TimelineEntry {
  id: string;
  label: string;
  emoji: string;
  /** Days from now until this position is expected to resolve. */
  days: number;
  amount: number;
}

export interface GoalDeadlineEntry {
  id: string;
  label: string;
  emoji: string;
  /** Days from now until the goal's deadline. Negative once it has passed. */
  days: number;
}

export interface GoalTimeline {
  positions: TimelineEntry[];
  deadlines: GoalDeadlineEntry[];
  /** Furthest point the strip has to draw, in days. At least 1 so it never collapses. */
  horizonDays: number;
}

/**
 * Positions and goal deadlines on one axis, so "do my positions finish before my
 * goal is due" stops being a question you answer by holding two screens in your
 * head.
 */
export function goalTimeline(
  bets: TrackedBet[],
  goals: SavingsGoal[],
  now: number = Date.now(),
): GoalTimeline {
  const positions: TimelineEntry[] = bets
    .filter((bet) => bet.status === 'active' && (bet.maturesInDays ?? 0) > 0)
    .map((bet) => ({
      id: bet.id,
      label: bet.description,
      emoji: bet.emoji,
      days: bet.maturesInDays as number,
      amount: bet.amountWagered,
    }))
    .sort((a, b) => a.days - b.days);

  const deadlines: GoalDeadlineEntry[] = goals
    .filter((goal) => !goal.achievedAt && goal.deadline)
    .map((goal) => ({
      id: goal.id,
      label: goal.label,
      emoji: goal.emoji,
      days: (Date.parse(goal.deadline as string) - now) / (24 * 60 * 60 * 1_000),
    }))
    .filter((entry) => Number.isFinite(entry.days))
    .sort((a, b) => a.days - b.days);

  const furthest = Math.max(
    1,
    ...positions.map((entry) => entry.days),
    ...deadlines.map((entry) => Math.max(entry.days, 0)),
  );
  return { positions, deadlines, horizonDays: furthest };
}

export interface CapitalEfficiency {
  id: string;
  label: string;
  emoji: string;
  category: string;
  staked: number;
  expectedProfit: number;
  /** Money that has to go in to earn one dollar of expected profit. */
  costPerDollar: number;
  riskLevel: number;
  shape: RiskShape;
}

/**
 * Your routes ranked by what a dollar of expected profit costs to buy on each.
 *
 * The useful question is not "which pays most" — that is answered by staking
 * more — but "which turns capital into progress most efficiently", because the
 * capital is the part in short supply. Positions with no expected profit are
 * dropped rather than ranked last: a cost per dollar with no dollar behind it is
 * a division by zero wearing a number.
 */
export function cheapestPaths(bets: TrackedBet[], conservative = false): CapitalEfficiency[] {
  return bets
    .filter((bet) => bet.status === 'active' && bet.amountWagered > 0)
    .map((bet) => {
      const expectedProfit = betEv(bet, conservative);
      return {
        id: bet.id,
        label: bet.description,
        emoji: bet.emoji,
        category: bet.category,
        staked: bet.amountWagered,
        expectedProfit,
        costPerDollar: expectedProfit > 0 ? bet.amountWagered / expectedProfit : Infinity,
        riskLevel: bet.riskLevel,
        shape: riskShapeFor(bet.category),
      };
    })
    .filter((entry) => Number.isFinite(entry.costPerDollar))
    .sort((a, b) => a.costPerDollar - b.costPerDollar);
}

export interface GoalContribution {
  id: string;
  label: string;
  emoji: string;
  /** Gains this position has produced. Losses included, and they read as negative. */
  netGain: number;
  /** Share of the total gains made, 0–100. Zero when nothing is up. */
  sharePct: number;
}

/**
 * Which positions actually produced the progress, biggest first.
 *
 * Shares are taken over the winners only. Dividing by the net of winners and
 * losers gives shares over 100% the moment anything is down, and a bar chart
 * that overflows its own track is worse than no bar chart.
 */
export function goalContributions(
  bets: TrackedBet[],
  gainById: (betId: string) => number,
): GoalContribution[] {
  const rows = bets
    .filter((bet) => bet.status === 'active')
    .map((bet) => ({
      id: bet.id,
      label: bet.description,
      emoji: bet.emoji,
      netGain: gainById(bet.id),
      sharePct: 0,
    }))
    .sort((a, b) => b.netGain - a.netGain);

  const upside = rows.reduce((sum, row) => sum + Math.max(0, row.netGain), 0);
  return rows.map((row) => ({
    ...row,
    sharePct: upside > 0 ? (Math.max(0, row.netGain) / upside) * 100 : 0,
  }));
}

export { __selfCheck } from '@/lib/portfolio-shape.check';
