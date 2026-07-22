import { StockQuote } from '@/api/client/market-data';
import { probabilityOfTargetMove } from '@/lib/volatility-probability';
import { Route } from '@/types/routes';

/**
 * Curated ETF universe — deliberately NOT "the ten biggest by AUM". The top-10 by
 * assets are four near-identical S&P 500 trackers plus a couple of growth funds,
 * which would drop redundant cards on the same spot of the risk map. Instead we pick
 * the largest, most liquid fund in each *distinct* risk bucket so the routes actually
 * span the safe→risky axis. Selection rule, stated plainly for the "why these" copy:
 * "the largest fund in each major asset class." No leveraged/inverse ETFs — their
 * multi-day behavior diverges from what a single-horizon volatility estimate implies
 * (volatility decay), which would poison the calibration claim.
 */
export interface EtfDefinition {
  symbol: string;
  name: string;
  bucket: string;
  riskLevel: number; // 1–5, position on the risk map
  expenseRatioPct: number;
}

export const ETF_UNIVERSE: EtfDefinition[] = [
  { symbol: 'BND', name: 'Vanguard Total Bond Market ETF', bucket: 'US bonds', riskLevel: 2, expenseRatioPct: 0.03 },
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', bucket: 'US large-cap equity', riskLevel: 3, expenseRatioPct: 0.03 },
  { symbol: 'VXUS', name: 'Vanguard Total International Stock ETF', bucket: 'International equity', riskLevel: 3, expenseRatioPct: 0.05 },
  { symbol: 'GLD', name: 'SPDR Gold Shares', bucket: 'Gold / diversifier', riskLevel: 3, expenseRatioPct: 0.4 },
  { symbol: 'QQQ', name: 'Invesco QQQ (Nasdaq-100)', bucket: 'US growth / tech', riskLevel: 4, expenseRatioPct: 0.2 },
];

export const ETF_SYMBOLS: string[] = ETF_UNIVERSE.map((etf) => etf.symbol);

/** Below this modeled hit-probability we still show the route but flag it as a reach for the goal. */
const REALISTIC_HIT_THRESHOLD = 50;

/** Calendar days → trading days (~252 trading days per 365 calendar days), matching market-quotes offsets. */
function tradingDays(calendarDays: number): number {
  return Math.max(1, Math.round((calendarDays * 252) / 365));
}

/**
 * Builds ETF routes from the curated universe. Probability is the volatility-derived
 * P(price moves >= targetPct within the horizon), zero-drift — the SAME unit and engine
 * as the tracked-stock routes, so it ranks alongside them. Mirrors buildTreasuryRoutes.
 */
export function buildEtfRoutes({
  quotes,
  balance,
  target,
  deadlineDays,
}: {
  quotes: StockQuote[];
  balance: number;
  target: number;
  deadlineDays: number;
}): Route[] {
  if (balance <= 0) return [];
  const targetPct = (target / balance) * 100;
  const horizonTradingDays = tradingDays(deadlineDays);
  const bySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));

  return ETF_UNIVERSE.flatMap((etf) => {
    const quote = bySymbol.get(etf.symbol);
    // No live volatility data → no fabricated number. Drop the route rather than guess.
    const probability = quote ? probabilityOfTargetMove(quote.dailyVol, targetPct, horizonTradingDays) : null;
    if (quote == null || probability == null) return [];

    const realistic = probability >= REALISTIC_HIT_THRESHOLD;
    const price = quote.price.toFixed(2);
    return [
      {
        id: `etf-${etf.symbol.toLowerCase()}`,
        category: 'Stocks & ETFs',
        emoji: '📈',
        description: `Put your $${balance.toLocaleString()} in ${etf.symbol} (${etf.name}, currently $${price}) — clears +${targetPct.toFixed(1)}% about ${probability.toFixed(0)}% of the time over ${deadlineDays}d, based on its recent volatility.`,
        riskLevel: etf.riskLevel,
        probability,
        expectedReturn: target, // profit if it hits the target move; capital preserved minus any decline otherwise
        platform: 'Brokerage',
        strategy: realistic
          ? `A ${etf.bucket} fund — the largest, most liquid name in its class. This estimate assumes no view on direction (zero drift), so for a broad index this is a conservative floor. Expense ratio ${etf.expenseRatioPct}%.`
          : `A ${etf.bucket} fund — the largest, most liquid name in its class. Hitting +${targetPct.toFixed(1)}% this fast is a reach on volatility alone; a longer timeframe raises the odds. Expense ratio ${etf.expenseRatioPct}%.`,
        maturesInDays: deadlineDays,
        lossProfile: 'partial',
        meetsTarget: realistic,
        investmentFacts: {
          expenseRatioPct: etf.expenseRatioPct,
          projectionBasis: `P(move ≥ +${targetPct.toFixed(1)}% in ${horizonTradingDays} trading days) from ~90-day realized volatility, zero drift`,
          liquidity: 'Sells same-day on any brokerage',
          sourceCheckedAt: new Date().toISOString(),
        },
      } satisfies Route,
    ];
  }).sort((a, b) => {
    const hit = Number(b.meetsTarget) - Number(a.meetsTarget);
    if (hit !== 0) return hit;
    return b.probability - a.probability;
  });
}
