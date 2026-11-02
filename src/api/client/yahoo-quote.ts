/**
 * A live quote for one tracked stock or coin, from Yahoo's chart endpoint. No
 * react-native import, so the server can use it as-is; the device wraps it with a
 * CORS proxy on web (see @/api/client/portfolio-live).
 */

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

/**
 * Fetches and parses one quote. `toRequestUrl` lets a caller route the public Yahoo URL
 * through a proxy; the server calls it directly.
 */
export async function fetchYahooQuote(
  symbol: string,
  toRequestUrl: (yahooUrl: string) => string = (url) => url,
): Promise<TrackedAssetQuote | null> {
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const response = await fetch(toRequestUrl(yahooUrl), { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    console.warn(`[yahoo-quote] ${symbol} quote failed (${response.status})`);
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
