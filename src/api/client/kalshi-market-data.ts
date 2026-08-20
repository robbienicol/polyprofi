import type { KalshiEntry } from '@/api/client/market-data-types';
import { isRecord, responseJson } from '@/lib/runtime-validation';

// Single-game moneyline series follow a "KX<LEAGUE>GAME" naming convention on
// Kalshi (confirmed live: KXMLBGAME, KXWNBAGAME return real per-game events;
// KXNBAGAME/KXNFLGAME/KXNHLGAME are the same pattern for their leagues but
// only return events while those leagues are in season).
const SPORTS_SERIES = ['KXNBAGAME', 'KXWNBAGAME', 'KXNFLGAME', 'KXMLBGAME', 'KXNHLGAME'] as const;
const MAX_PAGES_PER_SERIES = 10;

interface RawKalshiMarket {
  ticker: string;
  event_ticker: string;
  title: string;
  yes_sub_title?: string;
  no_sub_title?: string;
  yes_bid_dollars?: string | number | null;
  yes_ask_dollars?: string | number | null;
  no_bid_dollars?: string | number | null;
  no_ask_dollars?: string | number | null;
  volume_fp?: string | number | null;
  volume_24h_fp?: string | number | null;
  liquidity_dollars?: string | number | null;
  close_time?: string | null;
  open_time?: string | null;
  // The best proxy for actual game time — close_time is a resolution
  // deadline that includes a multi-day postponement buffer (confirmed live:
  // a market for a July 30 game had close_time August 2), so it's unusable
  // for same-day date matching against Polymarket's end date.
  expected_expiration_time?: string | null;
  status: string;
}

let rawSnapshotRequest: Promise<KalshiEntry[]> | null = null;
let rawSnapshotCache: { day: string; markets: KalshiEntry[] } | null = null;

export async function fetchKalshiSportsMarkets(): Promise<KalshiEntry[]> {
  return fetchSharedKalshiRaw();
}

// Cheap single-ticker lookup for a live price refresh — used at route-detail
// view time once the expensive daily match has already identified the ticker.
export async function fetchKalshiMarketByTicker(ticker: string): Promise<KalshiEntry | null> {
  let response: Response;
  try {
    response = await fetch(`https://api.elections.kalshi.com/trade-api/v2/markets/${ticker}`, {
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    console.warn(`[market-data:kalshi] ${ticker}: request failed`, error);
    return null;
  }
  if (!response.ok) {
    console.warn(`[market-data:kalshi] ${ticker}: ${response.status}`);
    return null;
  }
  const payload = await responseJson(response);
  const market = isRecord(payload) ? payload.market : undefined;
  if (!isRawKalshiMarket(market)) return null;
  return toKalshiEntry(market, market.event_ticker.split('-')[0]);
}

async function fetchSharedKalshiRaw(): Promise<KalshiEntry[]> {
  const day = new Date().toISOString().slice(0, 10);
  if (rawSnapshotCache?.day === day) return rawSnapshotCache.markets;
  if (rawSnapshotRequest) return rawSnapshotRequest;
  rawSnapshotRequest = fetchKalshiRaw()
    .then((markets) => {
      rawSnapshotCache = { day, markets };
      return markets;
    })
    .finally(() => {
      rawSnapshotRequest = null;
    });
  return rawSnapshotRequest;
}

async function fetchKalshiRaw(): Promise<KalshiEntry[]> {
  const perSeries = await Promise.all(SPORTS_SERIES.map((series) => fetchSeriesMarkets(series)));
  const entries = perSeries.flat();
  console.log(`[market-data:kalshi] ${entries.length} sports markets across ${SPORTS_SERIES.length} series`);
  return entries;
}

async function fetchSeriesMarkets(seriesTicker: string): Promise<KalshiEntry[]> {
  const results: KalshiEntry[] = [];
  let cursor = '';
  for (let page = 0; page < MAX_PAGES_PER_SERIES; page++) {
    const query = new URLSearchParams({ series_ticker: seriesTicker, status: 'open', limit: '200' });
    if (cursor) query.set('cursor', cursor);
    let response: Response;
    try {
      response = await fetch(`https://api.elections.kalshi.com/trade-api/v2/markets?${query}`, {
        headers: { Accept: 'application/json' },
      });
    } catch (error) {
      console.warn(`[market-data:kalshi] ${seriesTicker}: request failed`, error);
      return results;
    }
    if (!response.ok) {
      console.warn(`[market-data:kalshi] ${seriesTicker}: ${response.status}`);
      return results;
    }
    const payload = await responseJson(response);
    if (!isRecord(payload) || !Array.isArray(payload.markets)) return results;
    for (const market of payload.markets) {
      if (isRawKalshiMarket(market)) results.push(toKalshiEntry(market, seriesTicker));
    }
    cursor = typeof payload.cursor === 'string' ? payload.cursor : '';
    if (!cursor) break;
  }
  return results;
}

function toKalshiEntry(market: RawKalshiMarket, seriesTicker: string): KalshiEntry {
  return {
    ticker: market.ticker,
    eventTicker: market.event_ticker,
    seriesTicker,
    title: market.title,
    yesSubTitle: market.yes_sub_title,
    noSubTitle: market.no_sub_title,
    yesBid: finiteOptional(market.yes_bid_dollars),
    yesAsk: finiteOptional(market.yes_ask_dollars),
    noBid: finiteOptional(market.no_bid_dollars),
    noAsk: finiteOptional(market.no_ask_dollars),
    volume: finiteOptional(market.volume_fp),
    volume24h: finiteOptional(market.volume_24h_fp),
    liquidity: finiteOptional(market.liquidity_dollars),
    closeTime: typeof market.close_time === 'string' ? market.close_time : undefined,
    openTime: typeof market.open_time === 'string' ? market.open_time : undefined,
    expectedExpirationTime: typeof market.expected_expiration_time === 'string' ? market.expected_expiration_time : undefined,
    status: market.status,
  };
}

function finiteOptional(value: string | number | null | undefined): number | undefined {
  if (value == null) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function isRawKalshiMarket(value: unknown): value is RawKalshiMarket {
  if (!isRecord(value)) return false;
  return typeof value.ticker === 'string'
    && typeof value.event_ticker === 'string'
    && typeof value.title === 'string'
    && typeof value.status === 'string';
}
