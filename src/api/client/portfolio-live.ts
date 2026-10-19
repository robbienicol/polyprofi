import { Platform } from 'react-native';

import { fetchYahooQuote, type TrackedAssetQuote } from '@/api/client/yahoo-quote';

export type { TrackedAssetQuote } from '@/api/client/yahoo-quote';

/**
 * Yahoo supports native requests but does not send browser CORS headers. The web
 * build proxies only this public, read-only quote URL.
 */
function viaWebProxy(yahooUrl: string): string {
  return Platform.OS === 'web' ? `https://corsproxy.io/?url=${encodeURIComponent(yahooUrl)}` : yahooUrl;
}

export async function fetchTrackedAssetQuotes(symbols: string[]): Promise<TrackedAssetQuote[]> {
  const unique = [...new Set(symbols.filter(Boolean))];
  const results = await Promise.allSettled(unique.map((symbol) => fetchYahooQuote(symbol, viaWebProxy)));
  return results.flatMap((result) =>
    result.status === 'fulfilled' && result.value ? [result.value] : []
  );
}
