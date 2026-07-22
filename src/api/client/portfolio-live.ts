import { Platform } from 'react-native';

export interface TrackedAssetQuote {
  symbol: string;
  price: number;
  fetchedAt: string;
}

interface YahooChartResponse {
  chart?: {
    result?: {
      meta?: { regularMarketPrice?: number; symbol?: string };
    }[];
  };
}

async function fetchTrackedAssetQuote(symbol: string): Promise<TrackedAssetQuote | null> {
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  // Yahoo supports native requests but does not send browser CORS headers.
  // The web build proxies only this public, read-only quote URL.
  const requestUrl = Platform.OS === 'web'
    ? `https://corsproxy.io/?url=${encodeURIComponent(yahooUrl)}`
    : yahooUrl;
  const response = await fetch(
    requestUrl,
    { headers: { Accept: 'application/json' } }
  );

  if (!response.ok) {
    console.warn(`[portfolio-live] ${symbol} quote failed (${response.status})`);
    return null;
  }

  const data = (await response.json()) as YahooChartResponse;
  const meta = data.chart?.result?.[0]?.meta;
  if (!meta?.regularMarketPrice || !Number.isFinite(meta.regularMarketPrice)) return null;

  return {
    symbol: meta.symbol ?? symbol,
    price: meta.regularMarketPrice,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchTrackedAssetQuotes(symbols: string[]): Promise<TrackedAssetQuote[]> {
  const unique = [...new Set(symbols.filter(Boolean))];
  const results = await Promise.allSettled(unique.map(fetchTrackedAssetQuote));
  return results.flatMap((result) =>
    result.status === 'fulfilled' && result.value ? [result.value] : []
  );
}
