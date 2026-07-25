import { StockQuote } from '@/api/client/market-data';
import { probabilityOfTargetMove } from '@/lib/volatility-probability';
import { Route } from '@/types/routes';

/**
 * Curated crypto universe — the largest, most-liquid coins only. Priced via the same
 * Yahoo quote path as stocks (symbols like BTC-USD), so probability uses the identical
 * volatility engine and ranks alongside every other route. All riskLevel 5: crypto is
 * the high end of the map, so the quiz's risk cap keeps these off defensive goals and
 * surfaces them only for aggressive ones. No assumed drift — pure volatility, no
 * extrapolating a past run into a forecast.
 */
export interface CryptoDefinition {
  symbol: string; // Yahoo symbol, e.g. 'BTC-USD'
  ticker: string; // display ticker, e.g. 'BTC'
  name: string;
  emoji: string;
  riskLevel: number;
}

export const CRYPTO_UNIVERSE: CryptoDefinition[] = [
  { symbol: 'BTC-USD', ticker: 'BTC', name: 'Bitcoin', emoji: '₿', riskLevel: 5 },
  { symbol: 'ETH-USD', ticker: 'ETH', name: 'Ethereum', emoji: 'Ξ', riskLevel: 5 },
  { symbol: 'SOL-USD', ticker: 'SOL', name: 'Solana', emoji: '◎', riskLevel: 5 },
];

export const CRYPTO_SYMBOLS: string[] = CRYPTO_UNIVERSE.map((coin) => coin.symbol);

/** Calendar days → trading days. Crypto trades 24/7, but we keep the same unit as stocks for a comparable probability. */
function tradingDays(calendarDays: number): number {
  return Math.max(1, Math.round((calendarDays * 252) / 365));
}

/**
 * Builds crypto routes from the curated universe. Mirrors buildEtfRoutes: zero-drift
 * volatility probability, capital-preserving (partial) loss profile, one route per coin
 * that has a live quote. No live volatility → drop the route rather than fabricate a number.
 */
export function buildCryptoRoutes({
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

  return CRYPTO_UNIVERSE.flatMap((coin) => {
    const quote = bySymbol.get(coin.symbol);
    const probability = quote ? probabilityOfTargetMove(quote.dailyVol, targetPct, horizonTradingDays, 0) : null;
    if (quote == null || probability == null) return [];

    const price = quote.price.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return [
      {
        id: `crypto-${coin.ticker.toLowerCase()}`,
        category: 'Crypto',
        emoji: coin.emoji,
        description: `Put your $${balance.toLocaleString()} in ${coin.ticker} (${coin.name}, currently $${price}) — clears +${targetPct.toFixed(1)}% about ${probability.toFixed(0)}% of the time over ${deadlineDays}d, from its recent volatility alone.`,
        riskLevel: coin.riskLevel,
        probability,
        expectedReturn: target,
        platform: 'Crypto exchange',
        strategy: `${coin.name} priced from its own recent volatility — no assumed return baked in. Crypto swings far more than stocks, so the same target is both more reachable and easier to overshoot in either direction. Hold it in a reputable exchange or wallet; you keep whatever it's worth at your deadline.`,
        maturesInDays: deadlineDays,
        lossProfile: 'partial',
        meetsTarget: probability >= 50,
        investmentFacts: {
          projectionBasis: `P(move ≥ +${targetPct.toFixed(1)}% in ${horizonTradingDays} trading days) from ~90-day realized volatility, zero assumed drift`,
          liquidity: 'Trades 24/7 on major exchanges',
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
