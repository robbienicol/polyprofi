import { __selfCheck as checkPortfolioHistory } from '@/lib/portfolio-history';
import {
  calculatePortfolioProgress,
  cashFlowAdjustedChange,
  hasReachedProfitGoal,
} from '@/lib/portfolio-progress';
import type { TrackedBet } from '@/types/bets';

function invariant(condition: boolean, message: string): void {
  if (!condition) throw new Error(`[portfolio-progress] ${message}`);
}

function trackedBet(overrides: Partial<TrackedBet> = {}): TrackedBet {
  return {
    id: 'position-1',
    category: 'Stocks & ETFs',
    emoji: '📈',
    description: 'Put $1,000 in VOO at $100',
    platform: 'Robinhood',
    strategy: 'Buy VOO at $100',
    riskLevel: 2,
    probability: 60,
    expectedReturn: 100,
    amountWagered: 1_000,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    assetSymbol: 'VOO',
    assetEntryPrice: 100,
    ...overrides,
  };
}

export function __selfCheck(): void {
  checkPortfolioHistory();

  const principalOnly = calculatePortfolioProgress({
    active: [trackedBet({
      description: 'Put $3,000 in TSLA at $100',
      strategy: 'Buy TSLA at $100',
      amountWagered: 3_000,
      costBasis: 3_000,
      assetSymbol: 'TSLA',
    })],
    fallbackBalance: 3_000,
    statusesById: {},
    quotes: [{ symbol: 'TSLA', price: 100, fetchedAt: '2026-01-02T00:00:00.000Z' }],
    now: Date.parse('2026-01-02T00:00:00.000Z'),
  });
  invariant(principalOnly.value === 3_000, 'portfolio value keeps the $3,000 principal');
  invariant(principalOnly.goalProgress === 0, 'deposited principal does not count toward a profit goal');
  invariant(!hasReachedProfitGoal(principalOnly.goalProgress, 250), '$3,000 principal does not complete a $250 profit goal');

  const empty = calculatePortfolioProgress({
    active: [],
    fallbackBalance: 3_000,
    statusesById: {},
    quotes: [],
    now: Date.parse('2026-01-02T00:00:00.000Z'),
  });
  invariant(empty.value === 0, 'a portfolio with no positions is worth nothing, whatever the last search said');
  invariant(empty.basisValue === 0, 'an empty portfolio has no basis to chart against');

  const stockGain = calculatePortfolioProgress({
    active: [trackedBet({
      description: 'Put $3,000 in TSLA at $100',
      strategy: 'Buy TSLA at $100',
      amountWagered: 3_000,
      costBasis: 3_000,
      assetSymbol: 'TSLA',
    })],
    fallbackBalance: 3_000,
    statusesById: {},
    quotes: [{ symbol: 'TSLA', price: 110, fetchedAt: '2026-01-02T00:00:00.000Z' }],
    now: Date.parse('2026-01-02T00:00:00.000Z'),
  });
  invariant(Math.abs(stockGain.value - 3_300) < 0.001, 'portfolio value includes the $300 stock gain');
  invariant(Math.abs(stockGain.goalProgress - 300) < 0.001, 'only the $300 stock gain counts toward goal');
  invariant(hasReachedProfitGoal(stockGain.goalProgress, 250), 'a $300 net gain completes a $250 profit goal');

  const teslaChange = cashFlowAdjustedChange(
    { value: 1_000, basisValue: 1_000 },
    { value: 2_933.07, basisValue: 3_000 },
  );
  invariant(Math.abs(teslaChange.amount + 66.93) < 0.001, 'a $2,000 contribution is not counted as profit');
  invariant(Math.abs(teslaChange.percent + 2.231) < 0.001, 'return uses the $3,000 capital at risk');

  const treasuryGain = calculatePortfolioProgress({
    active: [trackedBet({
      category: 'Savings & Treasuries',
      assetSymbol: undefined,
      assetEntryPrice: undefined,
      annualYieldPct: 10,
      maturesInDays: 365,
    })],
    fallbackBalance: 1_000,
    statusesById: {},
    quotes: [],
    now: Date.parse('2027-01-01T00:00:00.000Z'),
  });
  invariant(Math.abs(treasuryGain.goalProgress - 100) < 0.001, 'Treasury interest accrues toward goal over time');

  const predictionGain = calculatePortfolioProgress({
    active: [trackedBet({ category: 'Polymarket', assetSymbol: undefined, assetEntryPrice: undefined })],
    fallbackBalance: 1_000,
    statusesById: {
      'position-1': {
        betId: 'position-1',
        unrealizedPnl: 75,
        currentPrice: 0.6,
        profitGoal: 100,
        profitGoalHit: false,
        sellRecommended: false,
        reason: 'Monitoring',
        isLive: true,
        fetchedAt: '2026-01-02T00:00:00.000Z',
      },
    },
    quotes: [],
    now: Date.parse('2026-01-02T00:00:00.000Z'),
  });
  invariant(predictionGain.goalProgress === 75, 'prediction-market mark-to-market gain counts toward goal');
}
