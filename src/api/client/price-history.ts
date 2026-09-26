import { Platform } from 'react-native';

import { rangeStartTime, type ChartRange } from '@/lib/chart-range';

/**
 * Intraday and daily price histories for the things a portfolio holds — what the
 * chart is drawn from. The chart used to be a record of the moments the app happened
 * to be open, resampled and smoothed, which drew hours of market movement as one
 * straight line. These are the market's own prints at a fixed interval, the same
 * series a brokerage chart is built on.
 */

export { CHART_RANGES, rangeStartTime, type ChartRange } from '@/lib/chart-range';

/** A US-equity trading day, epoch ms. Pre-market opens it, after-hours closes it. */
export interface TradingSession {
  preStart: number;
  regularStart: number;
  regularEnd: number;
  postEnd: number;
}

export interface PriceSeries {
  /** Epoch ms, ascending. */
  times: number[];
  prices: number[];
  /** The prior regular-session close. Only meaningful for 1D. */
  previousClose?: number;
  /** The session the 1D series belongs to. Absent for 24/7 instruments and longer ranges. */
  session?: TradingSession;
}

const DAY_MS = 24 * 60 * 60 * 1_000;

interface YahooPeriod { start?: number; end?: number }
interface YahooChart {
  chart?: {
    result?: {
      meta?: {
        chartPreviousClose?: number;
        previousClose?: number;
        currentTradingPeriod?: { pre?: YahooPeriod; regular?: YahooPeriod; post?: YahooPeriod };
      };
      timestamp?: number[];
      indicators?: { quote?: { close?: (number | null)[] }[] };
    }[];
  };
}

/**
 * Bar size per range, chosen to match what a brokerage draws: 5-minute bars across
 * the whole extended session for a day, finer than daily wherever the range is short
 * enough for it to matter.
 */
function yahooParams(range: ChartRange, since: number, now: number): string {
  switch (range) {
    case '1D': return 'interval=5m&range=1d&includePrePost=true';
    case '1W': return 'interval=15m&range=5d';
    case '1M': return 'interval=1h&range=1mo';
    case '3M': return 'interval=1d&range=3mo';
    case 'YTD': return 'interval=1d&range=ytd';
    case '1Y': return 'interval=1d&range=1y';
    case 'ALL': {
      // All of it is "since the first position", which for a young portfolio is days,
      // not years — daily bars over a week would draw six points.
      const span = now - since;
      const interval = span <= 2 * DAY_MS ? '5m' : span <= 8 * DAY_MS ? '15m' : span <= 60 * DAY_MS ? '1h' : '1d';
      return `interval=${interval}&period1=${Math.floor(since / 1_000)}&period2=${Math.ceil(now / 1_000)}`;
    }
  }
}

export async function fetchStockHistory(
  symbol: string,
  range: ChartRange,
  since: number,
  now: number,
): Promise<PriceSeries | null> {
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${yahooParams(range, since, now)}`;
  // Same CORS workaround as the live quote: web only, public read-only URL.
  const url = Platform.OS === 'web' ? `https://corsproxy.io/?url=${encodeURIComponent(yahooUrl)}` : yahooUrl;
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const data = (await response.json()) as YahooChart;
    const result = data.chart?.result?.[0];
    const stamps = result?.timestamp ?? [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    const times: number[] = [];
    const prices: number[] = [];
    stamps.forEach((stamp, index) => {
      const close = closes[index];
      if (typeof close === 'number' && Number.isFinite(close) && close > 0) {
        times.push(stamp * 1_000);
        prices.push(close);
      }
    });
    if (times.length === 0) return null;

    const meta = result?.meta;
    const period = meta?.currentTradingPeriod;
    const reported = range === '1D' && period?.pre?.start && period.regular?.start && period.regular.end && period.post?.end
      // A 24/7 symbol (BTC-USD) reports one period spanning the whole day; that is
      // not a session with extended hours, so it gets no shading.
      && period.pre.start !== period.regular.start
      ? {
        preStart: period.pre.start * 1_000,
        regularStart: period.regular.start * 1_000,
        regularEnd: period.regular.end * 1_000,
        postEnd: period.post.end * 1_000,
      }
      : undefined;
    // Over a weekend or holiday the bars are the last trading day's, while the
    // reported period can already be the next one. Lay the session over the bars.
    const lastBar = times[times.length - 1];
    const shift = reported && (lastBar < reported.preStart || lastBar > reported.postEnd)
      ? Math.floor((lastBar - reported.preStart) / DAY_MS) * DAY_MS
      : 0;
    const session = reported
      ? {
        preStart: reported.preStart + shift,
        regularStart: reported.regularStart + shift,
        regularEnd: reported.regularEnd + shift,
        postEnd: reported.postEnd + shift,
      }
      : undefined;

    return {
      times,
      prices,
      previousClose: range === '1D' ? meta?.chartPreviousClose ?? meta?.previousClose : undefined,
      session,
    };
  } catch {
    return null;
  }
}

/** Minutes per point, per range: dense enough to be jagged, few enough to draw. */
function clobFidelity(range: ChartRange, since: number, now: number): number {
  switch (range) {
    case '1D': return 5;
    case '1W': return 60;
    case '1M': return 180;
    case '3M':
    case 'YTD':
    case '1Y': return 1_440;
    case 'ALL': {
      const span = now - since;
      return span <= 2 * DAY_MS ? 5 : span <= 8 * DAY_MS ? 30 : span <= 60 * DAY_MS ? 180 : 1_440;
    }
  }
}

/** One outcome token's traded price over the range, from Polymarket's CLOB. */
export async function fetchOutcomeHistory(
  tokenId: string,
  range: ChartRange,
  since: number,
  now: number,
): Promise<PriceSeries | null> {
  const start = Math.floor(rangeStartTime(range, now, since) / 1_000);
  const url = `https://clob.polymarket.com/prices-history?market=${encodeURIComponent(tokenId)}&startTs=${start}&endTs=${Math.ceil(now / 1_000)}&fidelity=${clobFidelity(range, since, now)}`;
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const data = (await response.json()) as { history?: { t?: number; p?: number }[] };
    const times: number[] = [];
    const prices: number[] = [];
    for (const row of data.history ?? []) {
      if (typeof row.t === 'number' && typeof row.p === 'number' && Number.isFinite(row.p)) {
        times.push(row.t * 1_000);
        prices.push(row.p);
      }
    }
    return times.length > 0 ? { times, prices } : null;
  } catch {
    return null;
  }
}
