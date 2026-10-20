import { fetchYahooQuote, type TrackedAssetQuote } from '@/api/client/yahoo-quote';
import { memoized } from '@/server/shared/memo';

/** Matches how often the portfolio refreshes a live price. */
const QUOTE_TTL_MS = 15_000;
export const MAX_SYMBOLS = 50;

/** Live quotes for the given symbols; one Yahoo call per symbol per 15 s, shared by everyone. */
export async function liveQuotes(symbols: string[]): Promise<TrackedAssetQuote[]> {
  const unique = [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))].slice(0, MAX_SYMBOLS);
  const results = await Promise.allSettled(
    unique.map((symbol) => memoized(`quote:${symbol}`, QUOTE_TTL_MS, () => fetchYahooQuote(symbol))),
  );
  return results.flatMap((result) => (result.status === 'fulfilled' && result.value ? [result.value] : []));
}
