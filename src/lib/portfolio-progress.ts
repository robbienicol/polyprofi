import type { TrackedAssetQuote } from '@/api/client/portfolio-live';
import { isPredictionMarketBet } from '@/lib/parse-bet-line';
import { __selfCheck as checkPortfolioHistory } from '@/lib/portfolio-history';
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
  /** Net gains only. Used for P&L and position profit targets. */
  goalProgress: number;
  livePositions: number;
  projectedPositions: number;
  positionById: Record<string, PositionValuation>;
}

export interface PositionValuation {
  betId: string;
  symbol?: string;
  costBasis: number;
  quantity?: number;
  entryPrice?: number;
  currentPrice?: number;
  previousClose?: number;
  value: number;
  unrealizedPnl: number;
  returnPct: number;
  dayPnl?: number;
  dayChangePct?: number;
  asOf?: string;
  pricing: 'live' | 'projected' | 'unavailable';
}

interface PortfolioProgressInput {
  active: TrackedBet[];
  fallbackBalance: number;
  statusesById: Record<string, BetLiveStatus>;
  quotes: TrackedAssetQuote[];
  now: number;
}

export function cashFlowAdjustedChange(
  start: Pick<PortfolioProgressSnapshot, 'value' | 'basisValue'>,
  end: Pick<PortfolioProgressSnapshot, 'value' | 'basisValue'>
): { amount: number; percent: number } {
  const cashFlow = end.basisValue - start.basisValue;
  const amount = end.value - start.value - cashFlow;
  const capitalAtRisk = start.value + Math.max(0, cashFlow);
  return {
    amount,
    percent: capitalAtRisk > 0 ? (amount / capitalAtRisk) * 100 : 0,
  };
}

export function hasReachedProfitGoal(netGain: number, targetAmount: number): boolean {
  return targetAmount > 0 && netGain >= targetAmount;
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

export function stockIdentity(bet: TrackedBet): {
  symbol?: string;
  entryPrice?: number;
  quantity?: number;
  costBasis: number;
} {
  const entryPrice = bet.assetEntryPrice ?? inferAssetEntryPrice(bet.description, bet.strategy);
  const costBasis = bet.costBasis ?? bet.amountWagered;
  return {
    symbol: bet.assetSymbol ?? inferAssetSymbol(bet.description, bet.strategy, bet.line),
    entryPrice,
    quantity: bet.assetQuantity ?? (entryPrice && entryPrice > 0 ? costBasis / entryPrice : undefined),
    costBasis,
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
  const activeStake = active.reduce((sum, bet) => sum + (bet.costBasis ?? bet.amountWagered), 0);
  const basisValue = Math.max(fallbackBalance, activeStake);
  const cash = Math.max(0, basisValue - activeStake);
  let investedValue = 0;
  let livePnl = 0;
  let projectedPnl = 0;
  let livePositions = 0;
  let projectedPositions = 0;
  const positionById: Record<string, PositionValuation> = {};

  for (const bet of active) {
    const costBasis = bet.costBasis ?? bet.amountWagered;
    let pnl = 0;
    let valuation: PositionValuation = {
      betId: bet.id,
      costBasis,
      value: costBasis,
      unrealizedPnl: 0,
      returnPct: 0,
      pricing: 'unavailable',
    };

    if (isPredictionMarketBet(bet)) {
      const status = statusesById[bet.id];
      if (status?.currentPrice != null) {
        pnl = status.unrealizedPnl;
        livePnl += pnl;
        livePositions += 1;
        const entryPrice = status.entryPrice;
        valuation = {
          ...valuation,
          entryPrice,
          currentPrice: status.currentPrice,
          quantity: entryPrice && entryPrice > 0 ? costBasis / entryPrice : undefined,
          value: costBasis + pnl,
          unrealizedPnl: pnl,
          returnPct: costBasis > 0 ? (pnl / costBasis) * 100 : 0,
          asOf: status.fetchedAt,
          pricing: 'live',
        };
      }
    } else if (isStockOrEtfCategory(bet.category)) {
      const { symbol, entryPrice, quantity } = stockIdentity(bet);
      const quote = symbol ? quoteBySymbol.get(symbol) : undefined;
      valuation = { ...valuation, symbol, entryPrice, quantity };
      if (quote && entryPrice && entryPrice > 0 && quantity != null) {
        pnl = quantity * (quote.price - entryPrice);
        livePnl += pnl;
        livePositions += 1;
        const dayPnl = quote.previousClose && quote.previousClose > 0
          ? quantity * (quote.price - quote.previousClose)
          : undefined;
        valuation = {
          ...valuation,
          currentPrice: quote.price,
          previousClose: quote.previousClose,
          value: costBasis + pnl,
          unrealizedPnl: pnl,
          returnPct: costBasis > 0 ? (pnl / costBasis) * 100 : 0,
          dayPnl,
          dayChangePct: quote.previousClose && quote.previousClose > 0
            ? ((quote.price - quote.previousClose) / quote.previousClose) * 100
            : undefined,
          asOf: quote.marketTime ?? quote.fetchedAt,
          pricing: 'live',
        };
      }
    } else if (isSavingsOrTreasuryCategory(bet.category)) {
      pnl = projectedAccrual(bet, now);
      projectedPnl += pnl;
      projectedPositions += 1;
      valuation = {
        ...valuation,
        value: costBasis + pnl,
        unrealizedPnl: pnl,
        returnPct: costBasis > 0 ? (pnl / costBasis) * 100 : 0,
        asOf: new Date(now).toISOString(),
        pricing: 'projected',
      };
    }

    positionById[bet.id] = valuation;
    investedValue += costBasis + pnl;
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
    positionById,
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
