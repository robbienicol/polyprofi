import type { TrackedAssetQuote } from '@/api/client/portfolio-live';
import { isPredictionMarketBet } from '@/lib/parse-bet-line';
import {
  inferAssetEntryPrice,
  inferAssetSymbol,
  inferAnnualYieldPct,
  inferMaturityDays,
  isSavingsOrTreasuryCategory,
  isStockOrEtfCategory,
} from '@/lib/tracked-assets';
import type { BetLiveStatus, TrackedBet } from '@/types/bets';

const YEAR_MS = 365 * 24 * 60 * 60 * 1_000;

export interface PortfolioProgressSnapshot {
  /** Principal plus current gains/losses. Used for portfolio value displays. */
  value: number;
  basisValue: number;
  activeStake: number;
  livePnl: number;
  projectedPnl: number;
  /** Net gains only. This is the amount that counts toward a profit goal. */
  goalProgress: number;
  livePositions: number;
  projectedPositions: number;
}

interface PortfolioProgressInput {
  active: TrackedBet[];
  fallbackBalance: number;
  statusesById: Record<string, BetLiveStatus>;
  quotes: TrackedAssetQuote[];
  now: number;
}

export function hasReachedProfitGoal(goalProgress: number, targetAmount: number): boolean {
  return targetAmount > 0 && goalProgress >= targetAmount;
}

export function projectedAccrual(bet: TrackedBet, now: number): number {
  const elapsedMs = Math.max(0, now - new Date(bet.createdAt).getTime());
  const maturityDays = bet.maturesInDays ?? inferMaturityDays(bet.description, bet.strategy);
  const annualYieldPct = bet.annualYieldPct ?? inferAnnualYieldPct(bet.description, bet.strategy);
  const cappedMs = maturityDays
    ? Math.min(elapsedMs, maturityDays * 24 * 60 * 60 * 1_000)
    : elapsedMs;

  if (annualYieldPct != null) {
    return bet.amountWagered * (annualYieldPct / 100) * (cappedMs / YEAR_MS);
  }
  if (maturityDays && maturityDays > 0) {
    return bet.expectedReturn * Math.min(1, cappedMs / (maturityDays * 24 * 60 * 60 * 1_000));
  }
  return 0;
}

export function stockIdentity(bet: TrackedBet): { symbol?: string; entryPrice?: number } {
  return {
    symbol: bet.assetSymbol ?? inferAssetSymbol(bet.description, bet.strategy, bet.line),
    entryPrice: bet.assetEntryPrice ?? inferAssetEntryPrice(bet.description, bet.strategy),
  };
}

export function calculatePortfolioProgress({
  active,
  fallbackBalance,
  statusesById,
  quotes,
  now,
}: PortfolioProgressInput): PortfolioProgressSnapshot {
  const quoteBySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));
  const activeStake = active.reduce((sum, bet) => sum + bet.amountWagered, 0);
  const basisValue = Math.max(fallbackBalance, activeStake);
  const cash = Math.max(0, basisValue - activeStake);
  let investedValue = 0;
  let livePnl = 0;
  let projectedPnl = 0;
  let livePositions = 0;
  let projectedPositions = 0;

  for (const bet of active) {
    let pnl = 0;

    if (isPredictionMarketBet(bet)) {
      const status = statusesById[bet.id];
      if (status?.currentPrice != null) {
        pnl = status.unrealizedPnl;
        livePnl += pnl;
        livePositions += 1;
      }
    } else if (isStockOrEtfCategory(bet.category)) {
      const { symbol, entryPrice } = stockIdentity(bet);
      const quote = symbol ? quoteBySymbol.get(symbol) : undefined;
      if (quote && entryPrice && entryPrice > 0) {
        pnl = (bet.amountWagered / entryPrice) * (quote.price - entryPrice);
        livePnl += pnl;
        livePositions += 1;
      }
    } else if (isSavingsOrTreasuryCategory(bet.category)) {
      pnl = projectedAccrual(bet, now);
      projectedPnl += pnl;
      projectedPositions += 1;
    }

    investedValue += bet.amountWagered + pnl;
  }

  return {
    value: cash + investedValue,
    basisValue,
    activeStake,
    livePnl,
    projectedPnl,
    goalProgress: livePnl + projectedPnl,
    livePositions,
    projectedPositions,
  };
}

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
  const principalOnly = calculatePortfolioProgress({
    active: [trackedBet()],
    fallbackBalance: 1_000,
    statusesById: {},
    quotes: [{ symbol: 'VOO', price: 100, fetchedAt: '2026-01-02T00:00:00.000Z' }],
    now: Date.parse('2026-01-02T00:00:00.000Z'),
  });
  invariant(principalOnly.value === 1_000, 'portfolio value keeps principal');
  invariant(principalOnly.goalProgress === 0, 'deposited principal does not count toward a profit goal');
  invariant(!hasReachedProfitGoal(principalOnly.goalProgress, 1_000), '$1,000 principal does not complete a $1,000 profit goal');

  const stockGain = calculatePortfolioProgress({
    active: [trackedBet()],
    fallbackBalance: 1_000,
    statusesById: {},
    quotes: [{ symbol: 'VOO', price: 110, fetchedAt: '2026-01-02T00:00:00.000Z' }],
    now: Date.parse('2026-01-02T00:00:00.000Z'),
  });
  invariant(Math.abs(stockGain.value - 1_100) < 0.001, 'portfolio value includes stock gain');
  invariant(Math.abs(stockGain.goalProgress - 100) < 0.001, 'only stock gain counts toward goal');
  invariant(hasReachedProfitGoal(stockGain.goalProgress, 100), 'a genuine $100 gain completes a $100 profit goal');

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
