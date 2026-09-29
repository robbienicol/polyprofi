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

// ── self-check ──────────────────────────────────────────────────────────────
export function __selfCheck(): void {
  const bet = (over: Partial<TrackedBet>): TrackedBet => ({
    id: '1', category: 'Stocks & ETFs', emoji: '📈', description: 'x', platform: '', strategy: '',
    riskLevel: 3, probability: 50, expectedReturn: 100, amountWagered: 100, status: 'active',
    createdAt: '', ...over,
  });

  // ── risk shape ────────────────────────────────────────────────────────────
  console.assert(riskShapeFor('Polymarket') === 'binary', 'a prediction market is all or nothing');
  console.assert(riskShapeFor('Sports Betting') === 'binary', 'sports is all or nothing');
  console.assert(riskShapeFor('Options') === 'binary', 'options are all or nothing');
  console.assert(riskShapeFor('Savings & Treasury') === 'protected', 'savings principal is not market-exposed');
  console.assert(riskShapeFor('Stocks & ETFs') === 'market', 'equities are market-exposed');
  console.assert(riskShapeFor('Crypto') === 'market', 'crypto is market-exposed, not binary');

  // ── outcome range ─────────────────────────────────────────────────────────
  const range = outcomeRange([
    bet({ id: 'a', category: 'Polymarket', amountWagered: 100, expectedReturn: 150, probability: 40 }),
    bet({ id: 'b', category: 'Savings & Treasury', amountWagered: 200, expectedReturn: 10, probability: 99 }),
  ]);
  console.assert(range.staked === 300, 'staked is the principal');
  console.assert(range.best === 460, 'best case is every stake back plus every payout');
  console.assert(range.worst === 200, 'the binary stake is gone; protected principal survives');
  console.assert(range.worst < range.expected && range.expected < range.best, 'the average sits inside the range');
  console.assert(
    range.expectedPosition > 0 && range.expectedPosition < 1,
    'and so does its position on the bar',
  );
  const marketOnly = outcomeRange([bet({ category: 'Stocks & ETFs', riskLevel: 5, amountWagered: 100 })]);
  console.assert(marketOnly.worst === 25, 'a level-5 equity is marked down 75%, not wiped out');
  console.assert(outcomeRange([]).expectedPosition === 0.5, 'an empty range centres rather than dividing by zero');

  // ── capital split ─────────────────────────────────────────────────────────
  const split = capitalSplit([
    bet({ id: 'a', category: 'Polymarket', amountWagered: 250 }),
    bet({ id: 'b', category: 'Stocks & ETFs', amountWagered: 250 }),
    bet({ id: 'c', category: 'Savings & Treasury', amountWagered: 500 }),
    bet({ id: 'd', category: 'Polymarket', amountWagered: 999, status: 'watching' }),
  ]);
  console.assert(split.staked === 1_000, 'watched positions hold no money and are excluded');
  console.assert(split.atRisk === 250 && split.marketExposed === 250 && split.protectedCapital === 500, 'split by shape');
  console.assert(Math.abs(split.atRiskPct + split.marketExposedPct + split.protectedPct - 100) < 1e-9, 'shares total 100');
  console.assert(capitalSplit([]).atRiskPct === 0, 'no positions is no share, not a division by zero');

  // ── maturity ──────────────────────────────────────────────────────────────
  console.assert(averageDaysToMaturity([]) === null, 'nothing held has no average');
  console.assert(
    averageDaysToMaturity([bet({ id: 'a', amountWagered: 100, maturesInDays: 10 })]) === 10,
    'one position is its own average',
  );
  console.assert(
    averageDaysToMaturity([
      bet({ id: 'a', amountWagered: 300, maturesInDays: 100 }),
      bet({ id: 'b', amountWagered: 100, maturesInDays: 20 }),
    ]) === 80,
    'the average leans toward where the money is',
  );
  console.assert(
    averageDaysToMaturity([
      bet({ id: 'a', amountWagered: 100, maturesInDays: 30 }),
      bet({ id: 'b', amountWagered: 100 }),
    ]) === 30,
    'an undated position is left out rather than counted as finishing today',
  );

  // ── timeline ──────────────────────────────────────────────────────────────
  const now = Date.parse('2026-01-01T00:00:00.000Z');
  const day = 24 * 60 * 60 * 1_000;
  const timeline = goalTimeline(
    [bet({ id: 'a', maturesInDays: 40 }), bet({ id: 'b', maturesInDays: 10 })],
    [
      { id: 'g1', label: 'Trip', emoji: '✈️', targetAmount: 500, createdAt: '', deadline: new Date(now + 60 * day).toISOString() },
      { id: 'g2', label: 'Done', emoji: '🎧', targetAmount: 100, createdAt: '', achievedAt: new Date(now).toISOString(), deadline: new Date(now + 90 * day).toISOString() },
    ],
    now,
  );
  console.assert(timeline.positions.map((entry) => entry.id).join() === 'b,a', 'positions run soonest first');
  console.assert(timeline.deadlines.length === 1, 'a reached goal has no deadline left to meet');
  console.assert(timeline.horizonDays === 60, 'the strip reaches the furthest thing on it');
  console.assert(goalTimeline([], [], now).horizonDays === 1, 'an empty strip still has a width');

  // ── cheapest path ─────────────────────────────────────────────────────────
  const paths = cheapestPaths([
    // EV 20: 100 staked → $5 in for $1 of expected profit.
    bet({ id: 'cheap', category: 'Polymarket', probability: 60, expectedReturn: 100, amountWagered: 100 }),
    // EV 9: 100 staked → ~$11 in for $1.
    bet({ id: 'dear', category: 'Stocks & ETFs', probability: 90, expectedReturn: 10, amountWagered: 100 }),
    // EV −40: no expected profit to price, so it is not ranked at all.
    bet({ id: 'negative', category: 'Polymarket', probability: 20, expectedReturn: 100, amountWagered: 100 }),
  ]);
  console.assert(paths.map((entry) => entry.id).join() === 'cheap,dear', 'cheapest first, unprofitable dropped');
  console.assert(Math.abs(paths[0].costPerDollar - 5) < 1e-9, 'cost per dollar is stake over expected profit');
  console.assert(
    cheapestPaths([bet({ category: 'Stocks & ETFs' })], true).length === 0,
    'conservative mode zeroes equity profit, so there is no efficiency to rank',
  );

  // ── contributions ─────────────────────────────────────────────────────────
  const gains: Record<string, number> = { a: 60, b: 20, c: -30 };
  const contributions = goalContributions(
    [bet({ id: 'a' }), bet({ id: 'b' }), bet({ id: 'c' })],
    (id) => gains[id] ?? 0,
  );
  console.assert(contributions.map((row) => row.id).join() === 'a,b,c', 'biggest contributor first');
  console.assert(Math.abs(contributions[0].sharePct - 75) < 1e-9, 'shares are taken over the gains only');
  console.assert(contributions[2].sharePct === 0, 'a position that is down contributes no share');
  console.assert(
    contributions.reduce((sum, row) => sum + row.sharePct, 0) <= 100 + 1e-9,
    'shares never overflow the bar, even with a loser in the list',
  );
}
