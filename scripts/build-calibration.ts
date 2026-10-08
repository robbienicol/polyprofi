/// <reference types="node" />
/**
 * Builds the resolved-market calibration table read by @/lib/calibration.
 *
 * Run it with `npm run build:calibration`. It is deliberately a build step and not a
 * runtime fetch: a single cohort needs hundreds of settled markets and one price-history
 * request per market, which is minutes of traffic — not something a pick-details screen
 * can do while somebody waits. The output is a few kilobytes of counts, so the app ships
 * it and looks up synchronously, offline included.
 *
 * What it harvests, per venue:
 *   Polymarket — closed Gamma markets, walked in monthly end-date windows because the
 *     offset parameter caps out around 2,000 per query. Outcome comes from outcomePrices
 *     settling to exactly 1/0; anything else is an unresolved or void market and is dropped.
 *   Kalshi — settled markets per series (the general settled feed is ~99% zero-volume
 *     multivariate parlays, so it is unusable). Outcome comes from the `result` field.
 *
 * Two sampling rules matter more than anything else here:
 *
 *   Per-series cap. Kalshi runs hourly crypto and weather series that settle thousands of
 *     markets a month. Left uncapped they would swamp the table and it would describe
 *     hourly bitcoin, not prediction markets. Each series contributes at most
 *     MAX_MARKETS_PER_SERIES.
 *   One observation per market per lead band. We sample the price at ~1, ~7 and ~30 days
 *     before resolution and never more than once per band, so the counts the app reports
 *     an interval from are independent within the cell they land in.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import {
  LEAD_BUCKETS,
  cellKey,
  priceBucketIndex,
  type CalibrationVenue,
  type LeadBucket,
} from '@/lib/calibration';
import { netYesPrice } from '@/lib/platform-fees';
import { topicForTags } from '@/lib/prediction-topics';

const UA = { Accept: 'application/json', 'User-Agent': 'pathey-calibration/1.0' };
const DAY_MS = 86_400_000;
const OUTPUT = 'src/lib/calibration-data.ts';

/**
 * Scratch directory for a resumable harvest. A full sweep is tens of thousands of
 * requests over the better part of an hour, and losing all of it to a closed laptop
 * makes the table something nobody refreshes. Market lists are cached for the day and
 * per-market results are appended as they land, so a re-run picks up where it stopped
 * and costs only the batch that was in flight.
 */
const CACHE_DIR = '.calibration-cache';

const RESET = process.argv.includes('--reset');
const SMOKE = process.argv.includes('--smoke');
const PROGRESS_FILE = `${CACHE_DIR}/observations${SMOKE ? '-smoke' : ''}.ndjson`;

/** How far before a market stopped trading each band reads its price. */
const LEAD_TARGETS: Record<LeadBucket, { days: number }> = {
  closing: { days: 1 },
  week: { days: 7 },
  long: { days: 30 },
};

/** Fees are charged per contract and scale with size; 100 matches @/lib/market-comparison. */
const CONTRACTS_FOR_FEE_ESTIMATE = 100;

const MONTHS_BACK = 24;
const MAX_MARKETS_PER_SERIES = 30;
/**
 * Liquidity floors, kept low deliberately. A floor is itself a mild selection: a cheap
 * contract that comes in attracts volume, one that quietly expires does not, so a high
 * floor keeps the surprising winners and drops the boring losers. These sit at the same
 * liquidity the app will actually route somebody to, and no higher.
 */
const MIN_KALSHI_VOLUME = 1_000;
const MIN_POLYMARKET_VOLUME = 1_000;
const POLYMARKET_TARGET = 6_000;
const KALSHI_TARGET = 4_500;

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

/** One market's contribution, keyed so a resumed run knows to skip it. */
interface MarketResult {
  key: string;
  observations: Observation[];
}

interface Observation {
  venue: CalibrationVenue;
  topic: string;
  lead: LeadBucket;
  bucket: number;
  /** Price at the sampled lead time, 0–1. */
  price: number;
  yes: boolean;
}

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
}

/** Day-scoped so a refresh a week later re-fetches rather than rebuilding stale lists. */
function cached<T>(name: string, produce: () => Promise<T>): () => Promise<T> {
  return async () => {
    ensureCacheDir();
    // Namespaced by run size: a smoke run's deliberately truncated market list must
    // never be picked up by a full build later the same day.
    const path = `${CACHE_DIR}/${name}${SMOKE ? '-smoke' : ''}.json`;
    const today = new Date().toISOString().slice(0, 10);
    if (!RESET && existsSync(path)) {
      try {
        const parsed = JSON.parse(readFileSync(path, 'utf8')) as { day: string; value: T };
        if (parsed.day === today) {
          console.log(`  (reusing cached ${name})`);
          return parsed.value;
        }
      } catch {
        // A corrupt cache is not worth a failed build; fall through and re-fetch.
      }
    }
    const value = await produce();
    writeFileSync(path, JSON.stringify({ day: today, value }));
    return value;
  };
}

function loadProgress(): Map<string, Observation[]> {
  const done = new Map<string, Observation[]>();
  if (RESET || !existsSync(PROGRESS_FILE)) return done;
  for (const line of readFileSync(PROGRESS_FILE, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as MarketResult;
      done.set(parsed.key, parsed.observations);
    } catch {
      // A half-written final line from a killed run. Skipping it re-fetches one market.
    }
  }
  return done;
}

function recordProgress(key: string, observations: Observation[]): void {
  ensureCacheDir();
  appendFileSync(PROGRESS_FILE, `${JSON.stringify({ key, observations })}\n`);
}

/**
 * Minimum gap between request *starts*, per lane. Measured, not guessed: Kalshi's
 * markets and series endpoints happily serve 16 concurrent workers, but candlesticks
 * starts returning 429 at four — so the limiter has to be per endpoint rather than
 * per host, or the cheap sweep gets throttled to the speed of the expensive one.
 */
const LANE_MIN_INTERVAL_MS: Record<string, number> = {
  candlesticks: 150,
  polymarket: 30,
};

function laneFor(url: string): string | null {
  if (url.includes('/candlesticks')) return 'candlesticks';
  if (url.includes('polymarket.com')) return 'polymarket';
  return null;
}

const laneGate = new Map<string, Promise<void>>();

async function pace(url: string): Promise<void> {
  const lane = laneFor(url);
  const interval = lane ? LANE_MIN_INTERVAL_MS[lane] : 0;
  if (!lane || !interval) return;
  const previous = laneGate.get(lane) ?? Promise.resolve();
  let release: () => void = () => {};
  const mine = new Promise<void>((resolve) => { release = resolve; });
  laneGate.set(lane, previous.then(() => mine));
  await previous;
  setTimeout(release, interval);
}

async function fetchJson(url: string, attempts = 6): Promise<unknown> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    await pace(url);
    try {
      const response = await fetch(url, { headers: UA });
      if (response.status === 429 || response.status >= 500) throw new Error(`status ${response.status}`);
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      if (attempt === attempts - 1) {
        console.warn(`  ! ${url.slice(0, 90)}: ${error instanceof Error ? error.message : String(error)}`);
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, 700 * 2 ** attempt));
    }
  }
  return null;
}

async function pool<T, R>(items: T[], workers: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(workers, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results.push(await task(items[index]));
    }
  }));
  return results;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function numberOf(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The price this market was showing `days` before it stopped trading.
 *
 * Two decisions here are what keep the sample honest, and the first draft of this
 * function got both wrong in the same direction — flattering longshots by roughly
 * double.
 *
 * It anchors on the last point in the price series, not on the market's nominal end
 * date. Polymarket's endDate is a scheduled deadline, and a question that gets settled
 * early simply stops trading well before it. Measuring back from the scheduled date
 * would put the target after the series ended for exactly those markets, drop them, and
 * quietly delete every decisively-resolved question from the sample.
 *
 * And it carries the last known price forward rather than requiring a tick near the
 * target. A market nobody trades in its final week still has a price; dropping it for
 * want of a fresh tick throws away the dead longshots that resolve No, which are most
 * of the losing evidence. The only markets excluded from a band now are the ones that
 * genuinely did not exist that far back — an absence with no bias in it.
 */
function priceAtLead(
  series: { t: number; p: number }[],
  lead: LeadBucket,
): number | null {
  if (series.length === 0) return null;
  const ordered = [...series].sort((a, b) => a.t - b.t);
  const anchor = ordered[ordered.length - 1].t;
  const targetMs = anchor - LEAD_TARGETS[lead].days * DAY_MS;
  // Never existed this far out: a three-day market has no thirty-day price, and its
  // first tick is not one.
  if (targetMs < ordered[0].t) return null;

  let carried: number | null = null;
  for (const point of ordered) {
    if (point.t > targetMs) break;
    carried = point.p;
  }
  return carried;
}

function observationsFor(
  venue: CalibrationVenue,
  topic: string,
  series: { t: number; p: number }[],
  yes: boolean,
): Observation[] {
  const out: Observation[] = [];
  for (const lead of LEAD_BUCKETS) {
    const price = priceAtLead(series, lead);
    if (price == null) continue;
    const bucket = priceBucketIndex(price * 100);
    if (bucket == null) continue;
    out.push({ venue, topic, lead, bucket, price, yes });
  }
  return out;
}

// ---------------------------------------------------------------- Polymarket

interface PolyMarket {
  slug: string;
  yesTokenId: string;
  endDateMs: number;
  yesWon: boolean;
  topic: string;
}

async function harvestPolymarketMarkets(): Promise<PolyMarket[]> {
  const windows: { min: string; max: string }[] = [];
  const now = Date.now();
  for (let month = 0; month < (SMOKE ? 2 : MONTHS_BACK); month++) {
    windows.push({
      max: new Date(now - month * 30 * DAY_MS).toISOString(),
      min: new Date(now - (month + 1) * 30 * DAY_MS).toISOString(),
    });
  }

  const collected: PolyMarket[] = [];
  const seen = new Set<string>();
  for (const window of windows) {
    for (let offset = 0; offset <= (SMOKE ? 100 : 2000); offset += 100) {
      if (collected.length >= POLYMARKET_TARGET) break;
      const query = new URLSearchParams({
        closed: 'true',
        limit: '100',
        offset: String(offset),
        // By end date, never by volume. Volume is partly *caused* by the outcome: a
        // longshot that comes in draws a crowd, one that quietly expires does not. Paging
        // the most-traded markets first therefore oversamples cheap contracts that won,
        // and it does so hard enough to invert the result — measured on this data, the
        // 20–30¢ bucket read +50% ordered by volume and −36% ordered by date. Date is
        // outcome-neutral; volume is not.
        order: 'endDate',
        ascending: 'true',
        include_tag: 'true',
        end_date_min: window.min,
        end_date_max: window.max,
      });
      const payload = await fetchJson(`https://gamma-api.polymarket.com/markets?${query}`);
      if (!Array.isArray(payload) || payload.length === 0) break;
      for (const raw of payload) {
        const market = parsePolymarketMarket(raw);
        if (!market || seen.has(market.slug)) continue;
        seen.add(market.slug);
        collected.push(market);
      }
    }
    console.log(`  polymarket ${window.min.slice(0, 10)} → ${collected.length} resolved markets so far`);
    if (collected.length >= POLYMARKET_TARGET) break;
  }
  return collected;
}

function parsePolymarketMarket(raw: unknown): PolyMarket | null {
  if (!isRecord(raw)) return null;
  const slug = typeof raw.slug === 'string' ? raw.slug : null;
  const endDate = typeof raw.endDate === 'string' ? Date.parse(raw.endDate) : NaN;
  const volume = numberOf(raw.volumeNum) ?? 0;
  if (!slug || !Number.isFinite(endDate) || volume < MIN_POLYMARKET_VOLUME) return null;

  const prices = parseStringArray(raw.outcomePrices).map(Number);
  const outcomes = parseStringArray(raw.outcomes);
  if (prices.length !== 2 || outcomes.length !== 2) return null;
  // A cleanly settled binary market prices exactly 1/0. Anything else is still open,
  // void, or a 50/50 refund, and has no outcome to be right or wrong about.
  const yesWon = prices[0] === 1 && prices[1] === 0;
  const noWon = prices[0] === 0 && prices[1] === 1;
  if (yesWon === noWon) return null;

  const tokens = parseStringArray(raw.clobTokenIds);
  if (tokens.length !== 2 || !tokens[0]) return null;

  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((tag) => (isRecord(tag) && typeof tag.slug === 'string' ? tag.slug : ''))
    : [];
  return {
    slug,
    yesTokenId: tokens[0],
    endDateMs: endDate,
    yesWon,
    topic: topicForTags(tags) ?? 'other',
  };
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

async function polymarketObservations(
  markets: PolyMarket[],
  progress: Map<string, Observation[]>,
): Promise<Observation[]> {
  const pending = markets.filter((market) => !progress.has(`pm:${market.slug}`));
  console.log(`  polymarket history: ${markets.length - pending.length} cached, ${pending.length} to fetch`);
  let done = 0;
  const batches = await pool(pending, 8, async (market) => {
    const key = `pm:${market.slug}`;
    const query = new URLSearchParams({ market: market.yesTokenId, interval: 'max', fidelity: '1440' });
    const payload = await fetchJson(`https://clob.polymarket.com/prices-history?${query}`);
    done++;
    if (done % 500 === 0) console.log(`  polymarket history ${done}/${pending.length}`);
    if (!isRecord(payload) || !Array.isArray(payload.history)) {
      recordProgress(key, []);
      return [];
    }
    const series = payload.history.flatMap((point) => {
      if (!isRecord(point)) return [];
      const t = numberOf(point.t);
      const p = numberOf(point.p);
      return t != null && p != null ? [{ t: t * 1000, p }] : [];
    });
    const observations = series.length === 0
      ? []
      : observationsFor('polymarket', market.topic, series, market.yesWon);
    recordProgress(key, observations);
    return observations;
  });
  return [...batches.flat(), ...markets.flatMap((market) => progress.get(`pm:${market.slug}`) ?? [])];
}

// -------------------------------------------------------------------- Kalshi

interface KalshiMarket {
  ticker: string;
  seriesTicker: string;
  topic: string;
  closeTimeMs: number;
  yesWon: boolean;
}

async function harvestKalshiMarkets(): Promise<KalshiMarket[]> {
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

async function kalshiObservations(
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

// -------------------------------------------------------------------- output

type Cell = [number, number, number, number, number];

/**
 * Sums each cell's five running totals. The payout sums are the ones worth reading
 * twice: staking an equal amount on a market at price p buys 1/p contracts, so a
 * winner returns 1/p per unit staked and a loser returns nothing. Accumulating that
 * per market — rather than dividing a hit rate by a mean price later — is what makes
 * the reported return the actual average and not an average of averages.
 */
function aggregate(observations: Observation[]): Record<string, Cell> {
  const cells: Record<string, Cell> = {};
  for (const observation of observations) {
    const key = cellKey(observation.venue, observation.topic, observation.lead, observation.bucket);
    const cell = cells[key] ?? [0, 0, 0, 0, 0];
    const netPrice = netYesPrice(observation.price, observation.venue, CONTRACTS_FOR_FEE_ESTIMATE);
    cell[0] += 1;
    cell[1] += observation.yes ? 1 : 0;
    cell[2] += observation.price;
    if (observation.yes) {
      cell[3] += 1 / observation.price;
      cell[4] += 1 / netPrice;
    }
    cells[key] = cell;
  }
  return cells;
}

function render(cells: Record<string, Cell>, counts: Record<string, number>): string {
  const keys = Object.keys(cells).sort();
  const rows = keys.map((key) => {
    const [n, yes, priceSum, grossWin, netWin] = cells[key];
    return `  '${key}': [${n}, ${yes}, ${priceSum.toFixed(4)}, ${grossWin.toFixed(4)}, ${netWin.toFixed(4)}],`;
  }).join('\n');
  return `/**
 * GENERATED by scripts/build-calibration.ts — do not edit by hand.
 *
 * Counts of resolved prediction markets, keyed \`venue|topic|leadBand|priceBucket\`.
 * Each entry is [observations, resolved Yes, summed entry price, summed gross payout,
 * summed payout after fees]. Every field is a plain sum so that widening a cohort is
 * addition, and the payout sums carry the per-market return rather than one recovered
 * later from a hit rate over a mean price.
 *
 * The fee model behind the last field is @/lib/platform-fees as it stood at build time;
 * changing that module means rebuilding this table.
 *
 * Markets are sampled in end-date order, not by volume, because volume is partly caused
 * by the outcome — a longshot that lands draws a crowd and a longshot that expires does
 * not, so the most-traded markets are disproportionately the surprising ones.
 *
 * Coverage is not uniform, and @/lib/calibration widens a cohort rather than reporting
 * a thin one. Polymarket is swept across all topics; Kalshi's sweep is per series and
 * lands mostly on its high-volume recurring markets, so its non-sports cells are
 * thinner. Both are volume-filtered, which means these rates describe liquid markets —
 * the only ones the app routes anybody to — and not the long tail.
 */

export const CALIBRATION_BUILT_AT = '${new Date().toISOString()}';

export const CALIBRATION_MARKET_COUNTS = {
  polymarket: ${counts.polymarket ?? 0},
  kalshi: ${counts.kalshi ?? 0},
} as const;

export const CALIBRATION_CELLS: Record<string, readonly [number, number, number, number, number]> = {
${rows}
};
`;
}

async function main(): Promise<void> {
  console.log(SMOKE ? 'Building calibration table (smoke run)…' : 'Building calibration table…');

  const progress = loadProgress();
  if (progress.size > 0) console.log(`Resuming: ${progress.size} markets already harvested`);

  console.log('Polymarket: harvesting resolved markets');
  const polyMarkets = await cached('polymarket-markets', harvestPolymarketMarkets)();
  console.log(`Polymarket: ${polyMarkets.length} resolved markets, fetching price history`);
  const polyObservations = await polymarketObservations(polyMarkets, progress);
  console.log(`Polymarket: ${polyObservations.length} observations`);

  console.log('Kalshi: sweeping series for settled markets');
  const kalshiMarkets = await cached('kalshi-markets', harvestKalshiMarkets)();
  console.log(`Kalshi: ${kalshiMarkets.length} settled markets, fetching candlesticks`);
  const kalshiObs = await kalshiObservations(kalshiMarkets, progress);
  console.log(`Kalshi: ${kalshiObs.length} observations`);

  const cells = aggregate([...polyObservations, ...kalshiObs]);
  writeFileSync(OUTPUT, render(cells, { polymarket: polyMarkets.length, kalshi: kalshiMarkets.length }));
  console.log(`Wrote ${OUTPUT}: ${Object.keys(cells).length} cells`);
}

void main();
