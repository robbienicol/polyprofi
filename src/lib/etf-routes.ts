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

/**
 * We credit each fund a modest assumed annual return so a broad index isn't understated by a
 * pure wobble model — but cap it so we never extrapolate a recent boom (QQQ's 25%/yr does not
 * become a 25%/yr forecast). The fund's own 5-year trend, capped here. Disclosed in the copy.
 */
const MAX_ASSUMED_ANNUAL_DRIFT_PCT = 8;

function assumedAnnualDriftPct(quote: StockQuote): number {
  return Math.min(quote.annualized5yPct ?? 0, MAX_ASSUMED_ANNUAL_DRIFT_PCT);
}

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
    const driftPct = quote ? assumedAnnualDriftPct(quote) : 0;
    const probability = quote ? probabilityOfTargetMove(quote.dailyVol, targetPct, horizonTradingDays, driftPct) : null;
    if (quote == null || probability == null) return [];

    const realistic = probability >= REALISTIC_HIT_THRESHOLD;
    const price = quote.price.toFixed(2);
    return [
      {
        id: `etf-${etf.symbol.toLowerCase()}`,
        category: 'Stocks & ETFs',
        emoji: '📈',
        description: `Put your $${balance.toLocaleString()} in ${etf.symbol} (${etf.name}, currently $${price}) — clears +${targetPct.toFixed(1)}% about ${probability.toFixed(0)}% of the time over ${deadlineDays}d, from its recent volatility plus a ${driftPct.toFixed(1)}%/yr assumed return.`,
        riskLevel: etf.riskLevel,
        probability,
        expectedReturn: target, // profit if it hits the target move; capital preserved minus any decline otherwise
        platform: 'Brokerage',
        strategy: realistic
          ? `A ${etf.bucket} fund — the largest, most liquid name in its class. Odds use its own long-run trend as a modest assumed return (${driftPct.toFixed(1)}%/yr, capped at ${MAX_ASSUMED_ANNUAL_DRIFT_PCT}%), not a promise it repeats. Expense ratio ${etf.expenseRatioPct}%.`
          : `A ${etf.bucket} fund — the largest, most liquid name in its class. Even crediting a ${driftPct.toFixed(1)}%/yr long-run trend, hitting +${targetPct.toFixed(1)}% this fast is a reach; a longer timeframe raises the odds. Expense ratio ${etf.expenseRatioPct}%.`,
        maturesInDays: deadlineDays,
        lossProfile: 'partial',
        meetsTarget: realistic,
        investmentFacts: {
          expenseRatioPct: etf.expenseRatioPct,
          projectionBasis: `P(move ≥ +${targetPct.toFixed(1)}% in ${horizonTradingDays} trading days) from ~90-day realized volatility + ${driftPct.toFixed(1)}%/yr assumed return (5y trend, capped ${MAX_ASSUMED_ANNUAL_DRIFT_PCT}%)`,
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

// ── self-check ──────────────────────────────────────────────────────────────
function fakeQuote(symbol: string, dailyVol: number | null, annualized5yPct: number | null = null): StockQuote {
  return {
    symbol, name: symbol, price: 100, change: 0, changePct: 0, volume: 0,
    change1wPct: null, change1mPct: null, change3mPct: null, change1yPct: null, dailyVol, annualized5yPct,
  };
}

export function __selfCheck(): void {
  const quotes = ETF_UNIVERSE.map((etf) => fakeQuote(etf.symbol, 0.01)); // ~1% daily vol each

  const routes = buildEtfRoutes({ quotes, balance: 10000, target: 200, deadlineDays: 365 });
  console.assert(routes.length === ETF_UNIVERSE.length, 'one route per funded ETF');
  console.assert(routes.every((r) => r.probability >= 0 && r.probability <= 100), 'probability in 0–100');
  console.assert(routes.every((r) => r.category === 'Stocks & ETFs' && r.lossProfile === 'partial'), 'ETF routes are partial-loss equities');
  console.assert(routes.every((r) => r.investmentFacts?.projectionBasis?.includes('assumed return')), 'discloses assumed-return basis');

  // a fund with a positive long-run trend gets a higher hit-probability than an identical flat one
  const trending = buildEtfRoutes({ quotes: [fakeQuote('VOO', 0.009, 15)], balance: 10000, target: 800, deadlineDays: 365 })[0];
  const flat = buildEtfRoutes({ quotes: [fakeQuote('VOO', 0.009, 0)], balance: 10000, target: 800, deadlineDays: 365 })[0];
  console.assert(trending.probability > flat.probability, 'positive 5y trend → higher P(hit)');
  console.assert(trending.probability >= 45 && trending.probability <= 60, 'capped drift keeps a broad-index +8%/1yr near a coin flip, not inflated');

  // sorted: goal-clearing first, then by descending probability
  const hits = routes.map((r) => Number(r.meetsTarget));
  console.assert(hits.join('') === [...hits].sort((a, b) => b - a).join(''), 'meetsTarget routes sort first');

  // missing live data → route dropped, never a fabricated number
  const partial = buildEtfRoutes({ quotes: [fakeQuote('VOO', 0.01)], balance: 10000, target: 200, deadlineDays: 365 });
  console.assert(partial.length === 1 && partial[0].id === 'etf-voo', 'only ETFs with live quotes appear');
  const noVol = buildEtfRoutes({ quotes: [fakeQuote('VOO', null)], balance: 10000, target: 200, deadlineDays: 365 });
  console.assert(noVol.length === 0, 'no volatility data → no route (no fake probability)');

  console.assert(buildEtfRoutes({ quotes, balance: 0, target: 200, deadlineDays: 365 }).length === 0, 'zero balance → no routes');

  // a bigger target over the same horizon is harder → lower probability
  const easy = buildEtfRoutes({ quotes: [fakeQuote('VOO', 0.01)], balance: 10000, target: 100, deadlineDays: 365 })[0];
  const hard = buildEtfRoutes({ quotes: [fakeQuote('VOO', 0.01)], balance: 10000, target: 3000, deadlineDays: 365 })[0];
  console.assert(easy.probability > hard.probability, 'harder target → lower P(hit)');
}
