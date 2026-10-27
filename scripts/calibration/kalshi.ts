/// <reference types="node" />
import {
  DAY_MS,
  KALSHI_TARGET,
  MAX_MARKETS_PER_SERIES,
  MIN_KALSHI_VOLUME,
  MONTHS_BACK,
  SMOKE,
  type Observation,
} from './config';
import { fetchJson, isRecord, numberOf, pool, recordProgress } from './io';
import { observationsFor } from './observations';

const KALSHI_CATEGORY_TOPICS: Record<string, string> = {
  Sports: 'sports',
  Crypto: 'crypto',
  Politics: 'politics',
  Elections: 'politics',
  Financials: 'economy',
  Economics: 'economy',
  Commodities: 'economy',
  Companies: 'economy',
  Entertainment: 'culture',
  Social: 'culture',
  Mentions: 'culture',
  World: 'world',
  'Climate and Weather': 'world',
  Health: 'world',
  'Science and Technology': 'world',
  Transportation: 'world',
  Education: 'world',
  AI: 'world',
};

export interface KalshiMarket {
  ticker: string;
  seriesTicker: string;
  topic: string;
  closeTimeMs: number;
  yesWon: boolean;
}

export async function harvestKalshiMarkets(): Promise<KalshiMarket[]> {
  const payload = await fetchJson('https://api.elections.kalshi.com/trade-api/v2/series?limit=1000');
  const rawSeries = isRecord(payload) && Array.isArray(payload.series) ? payload.series : [];
  const series = rawSeries.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.ticker !== 'string') return [];
    const topic = KALSHI_CATEGORY_TOPICS[String(entry.category)] ?? 'other';
    return [{ ticker: entry.ticker, topic }];
  });
  console.log(`  kalshi ${series.length} series to sweep`);

  const cutoff = Date.now() - MONTHS_BACK * 30 * DAY_MS;
  let swept = 0;
  const perSeries = await pool(SMOKE ? series.slice(0, 300) : series, 16, async (entry) => {
    const query = new URLSearchParams({ series_ticker: entry.ticker, status: 'settled', limit: '200' });
    const response = await fetchJson(`https://api.elections.kalshi.com/trade-api/v2/markets?${query}`);
    swept++;
    if (swept % 2000 === 0) console.log(`  kalshi swept ${swept}/${series.length} series`);
    if (!isRecord(response) || !Array.isArray(response.markets)) return [];

    const usable: KalshiMarket[] = [];
    for (const raw of response.markets) {
      if (!isRecord(raw)) continue;
      const ticker = typeof raw.ticker === 'string' ? raw.ticker : null;
      const result = typeof raw.result === 'string' ? raw.result : '';
      const closeTime = typeof raw.close_time === 'string' ? Date.parse(raw.close_time) : NaN;
      const volume = numberOf(raw.volume_fp) ?? 0;
      if (!ticker || !Number.isFinite(closeTime) || closeTime < cutoff) continue;
      if (volume < MIN_KALSHI_VOLUME) continue;
      if (result !== 'yes' && result !== 'no') continue;
      usable.push({ ticker, seriesTicker: entry.ticker, topic: entry.topic, closeTimeMs: closeTime, yesWon: result === 'yes' });
    }
    // Newest first, then capped: one hourly series must not outweigh a whole category.
    usable.sort((a, b) => b.closeTimeMs - a.closeTimeMs);
    return usable.slice(0, MAX_MARKETS_PER_SERIES);
  });

  const all = perSeries.flat();
  // Spread the cap across series rather than taking the first N, which would be
  // alphabetical by whichever series happened to finish its request first.
  all.sort((a, b) => b.closeTimeMs - a.closeTimeMs);
  return all.slice(0, SMOKE ? 400 : KALSHI_TARGET);
}

export async function kalshiObservations(
  markets: KalshiMarket[],
  progress: Map<string, Observation[]>,
): Promise<Observation[]> {
  const pending = markets.filter((market) => !progress.has(`kx:${market.ticker}`));
  console.log(`  kalshi history: ${markets.length - pending.length} cached, ${pending.length} to fetch`);
  let done = 0;
  const batches = await pool(pending, 8, async (market) => {
    const key = `kx:${market.ticker}`;
    const startTs = Math.floor((market.closeTimeMs - 45 * DAY_MS) / 1000);
    const endTs = Math.floor(market.closeTimeMs / 1000);
    const url = `https://api.elections.kalshi.com/trade-api/v2/series/${market.seriesTicker}`
      + `/markets/${market.ticker}/candlesticks?start_ts=${startTs}&end_ts=${endTs}&period_interval=1440`;
    const payload = await fetchJson(url);
    done++;
    if (done % 500 === 0) console.log(`  kalshi history ${done}/${pending.length}`);
    if (!isRecord(payload) || !Array.isArray(payload.candlesticks)) {
      recordProgress(key, []);
      return [];
    }

    const series = payload.candlesticks.flatMap((candle) => {
      if (!isRecord(candle)) return [];
      const ts = numberOf(candle.end_period_ts);
      if (ts == null) return [];
      // Last trade where the day traded at all; otherwise the mid of the closing quote,
      // which is what a taker would have actually faced.
      const price = isRecord(candle.price) ? numberOf(candle.price.close_dollars) : null;
      if (price != null && price > 0) return [{ t: ts * 1000, p: price }];
      const bid = isRecord(candle.yes_bid) ? numberOf(candle.yes_bid.close_dollars) : null;
      const ask = isRecord(candle.yes_ask) ? numberOf(candle.yes_ask.close_dollars) : null;
      if (bid == null || ask == null || ask <= 0) return [];
      return [{ t: ts * 1000, p: (bid + ask) / 2 }];
    });
    const observations = series.length === 0
      ? []
      : observationsFor('kalshi', market.topic, series, market.yesWon);
    recordProgress(key, observations);
    return observations;
  });
  return [...batches.flat(), ...markets.flatMap((market) => progress.get(`kx:${market.ticker}`) ?? [])];
}
