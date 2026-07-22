import type { MetaculusQuestion, PolymarketEntry, StockQuote, TreasuryBillYield } from '@/api/client/market-data-types';
import { probabilityOfTargetMove } from '@/lib/volatility-probability';

export function formatPolymarketContext(markets: PolymarketEntry[]): string {
  return markets.map((market) => {
    const odds = market.outcomes.map((outcome, index) => `${outcome}: ${((market.prices[index] ?? 0) * 100).toFixed(1)}%`).join(' / ');
    return `• ${market.question}\n  ${odds} | vol: $${market.volumeM.toFixed(1)}M`;
  }).join('\n');
}

export function formatPopularPolymarketContext(markets: PolymarketEntry[]): string {
  if (markets.length === 0) return 'Unavailable';
  return markets.slice(0, 25).map((market, index) => `${index + 1}. ${market.question} — Yes ${((market.prices[0] ?? 0) * 100).toFixed(0)}¢ | $${market.volumeM.toFixed(1)}M vol`).join('\n');
}

export function formatMetaculusContext(questions: MetaculusQuestion[]): string {
  return questions.length === 0 ? 'Unavailable' : questions.slice(0, 15).map((item) => `• ${item.question}\n  Metaculus: ${(item.probability * 100).toFixed(1)}%`).join('\n');
}

export function formatStocksContext(quotes: StockQuote[], goal?: { targetPct: number; horizonTradingDays: number }): string {
  if (quotes.length === 0) return 'Unavailable';
  return quotes.map((quote) => {
    const yieldText = quote.yieldPct != null ? ` | ${quote.yieldLabel}: ${quote.yieldPct.toFixed(2)}% as of ${quote.yieldAsOf} (${quote.yieldSource})` : '';
    const base = `${quote.symbol} (${quote.name}): $${quote.price.toFixed(2)} | 1d: ${optionalSigned(quote.changePct)} | 1w: ${optionalSigned(quote.change1wPct)} | 1m: ${optionalSigned(quote.change1mPct)} | 3m: ${optionalSigned(quote.change3mPct)} | 1y: ${optionalSigned(quote.change1yPct)} | 5y annualized: ${optionalSigned(quote.annualized5yPct ?? null)} | vol: ${(quote.volume / 1e6).toFixed(1)}M${yieldText}`;
    if (!goal) return base;
    const probability = probabilityOfTargetMove(quote.dailyVol, goal.targetPct, goal.horizonTradingDays);
    return `${base} | P(+${goal.targetPct.toFixed(1)}% within horizon): ${probability != null ? `${probability.toFixed(0)}%` : 'n/a (insufficient history)'}`;
  }).join('\n');
}

export function formatTreasuryBillContext(yields: TreasuryBillYield[]): string {
  return yields.length === 0 ? 'Unavailable' : yields.map((term) => `${term.label}: ${term.yieldPct.toFixed(2)}% coupon-equivalent yield | maturity: ${term.days}d | as of ${term.yieldAsOf} | source: ${term.yieldSource}`).join('\n');
}

function optionalSigned(value: number | null): string {
  return value === null ? 'n/a' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}
