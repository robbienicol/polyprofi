/// <reference types="node" />
import { topicForTags } from '@/lib/prediction-topics';

import {
  DAY_MS,
  MIN_POLYMARKET_VOLUME,
  MONTHS_BACK,
  POLYMARKET_TARGET,
  SMOKE,
  type Observation,
} from './config';
import { fetchJson, isRecord, numberOf, pool, recordProgress } from './io';
import { observationsFor } from './observations';

export interface PolyMarket {
  slug: string;
  yesTokenId: string;
  endDateMs: number;
  yesWon: boolean;
  topic: string;
}

export async function harvestPolymarketMarkets(): Promise<PolyMarket[]> {
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

export async function polymarketObservations(
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
