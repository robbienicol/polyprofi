import { Platform } from 'react-native';

export interface TrackedAssetQuote {
  symbol: string;
  price: number;
  previousClose?: number;
  fetchedAt: string;
  marketTime?: string;
}

interface YahooChartResponse {
  chart?: {
    result?: {
      meta?: {
        regularMarketPrice?: number;
        previousClose?: number;
        regularMarketTime?: number;
        symbol?: string;
      };
      indicators?: {
        quote?: { close?: (number | null)[] }[];
      };
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
  const result = data.chart?.result?.[0];
  const meta = result?.meta;
  if (!meta?.regularMarketPrice || !Number.isFinite(meta.regularMarketPrice)) return null;
  const closes = result?.indicators?.quote?.[0]?.close?.filter(
    (price): price is number => typeof price === 'number' && Number.isFinite(price)
  ) ?? [];
  const previousDailyClose = closes.length >= 2 ? closes[closes.length - 2] : meta.previousClose;

  return {
    symbol: meta.symbol ?? symbol,
    price: meta.regularMarketPrice,
    previousClose: previousDailyClose,
    fetchedAt: new Date().toISOString(),
    marketTime: meta.regularMarketTime
      ? new Date(meta.regularMarketTime * 1_000).toISOString()
      : undefined,
  };
}

export async function fetchTrackedAssetQuotes(symbols: string[]): Promise<TrackedAssetQuote[]> {
  const unique = [...new Set(symbols.filter(Boolean))];
  const results = await Promise.allSettled(unique.map(fetchTrackedAssetQuote));
  return results.flatMap((result) =>
    result.status === 'fulfilled' && result.value ? [result.value] : []
  );
}
