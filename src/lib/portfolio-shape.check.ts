import {
  averageDaysToMaturity,
  capitalSplit,
  cheapestPaths,
  goalContributions,
  goalTimeline,
  outcomeRange,
  riskShapeFor,
} from '@/lib/portfolio-shape';
import type { TrackedBet } from '@/types/bets';

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
