import type { PolymarketEntry } from '@/api/client/market-data-types';
import {
  balancePolymarketUniverse,
  DAY_MS,
  HORIZON_LIMITS,
  polymarketMaturityDays,
} from '@/api/client/polymarket-maturity';
import { isRawMarket, parseStringArray, toPolymarketEntry, type RawMarket } from '@/api/client/polymarket-raw';
import { responseJson } from '@/lib/runtime-validation';

export {
  balancePolymarketUniverse,
  filterPolymarketMarketsForTimeframe,
  polymarketMaturityDays,
} from '@/api/client/polymarket-maturity';
export {
  fetchPolymarketMarketsByQuestion,
  fetchPolymarketMarketsBySlug,
  polymarketSlugCandidate,
  searchPolymarketByKeyword,
} from '@/api/client/polymarket-search';

export interface PolymarketSnapshot {
  context: PolymarketEntry[];
  universe: PolymarketEntry[];
}

let rawSnapshotRequest: Promise<RawMarket[]> | null = null;
let rawSnapshotCache: { day: string; markets: RawMarket[] } | null = null;

export async function fetchPolymarket(): Promise<PolymarketEntry[]> {
  return (await fetchPolymarketSnapshot()).context;
}

export async function fetchPolymarketUniverse(limit = 240): Promise<PolymarketEntry[]> {
  return (await fetchPolymarketSnapshot(limit)).universe;
}

/**
 * `fresh` skips the per-day memory cache. The server wants that: it caches the snapshot
 * itself for minutes, and a day-old copy held in a long-lived instance would pin prices.
 */
export async function fetchPolymarketSnapshot(
  universeLimit = 240,
  { fresh = false }: { fresh?: boolean } = {},
): Promise<PolymarketSnapshot> {
  const raw = fresh ? await fetchPolymarketRaw() : await fetchSharedPolymarketRaw();
  const context = selectPolymarketContext(raw);
  const universe = selectPolymarketUniverse(raw, universeLimit);
  console.log(`[market-data:polymarket] ${raw.length} fetched, ${context.length} context, ${universe.length} universe`);
  return { context, universe };
}

async function fetchSharedPolymarketRaw(): Promise<RawMarket[]> {
  const day = new Date().toISOString().slice(0, 10);
  if (rawSnapshotCache?.day === day) return rawSnapshotCache.markets;
  if (rawSnapshotRequest) return rawSnapshotRequest;
  rawSnapshotRequest = fetchPolymarketRaw()
    .then((markets) => {
      rawSnapshotCache = { day, markets };
      return markets;
    })
    .finally(() => {
      rawSnapshotRequest = null;
    });
  return rawSnapshotRequest;
}

function selectPolymarketContext(raw: RawMarket[]): PolymarketEntry[] {
  const liquid = raw.filter((market) => (market.volumeNum ?? 0) > 50_000 && market.outcomePrices.length > 0);
  return liquid
    .map((market) => {
      const yes = Number(parseStringArray(market.outcomePrices)[0] ?? 0.5);
      const controversy = 1 - Math.abs(yes - 0.5) * 2;
      const volumeScore = Math.log10((market.volumeNum ?? 1) / 50_000);
      return { market, score: controversy * 0.6 + volumeScore * 0.4 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)
    .map(({ market }) => toPolymarketEntry(market));
}

function selectPolymarketUniverse(raw: RawMarket[], limit: number): PolymarketEntry[] {
  const valid = raw
    .map(toPolymarketEntry)
    .filter((market) => market.prices.length === 2
      && market.outcomes.length === 2
      && market.volumeM >= 0.001
      && polymarketMaturityDays(market.endDate) != null
      && market.prices.every((price) => Number.isFinite(price) && price >= 0.02 && price <= 0.98));
  return balancePolymarketUniverse(valid, limit);
}

async function fetchPolymarketRaw(): Promise<RawMarket[]> {
  const now = Date.now();
  // allSettled, not all: one horizon band failing its request must not take the
  // whole snapshot — and with it the whole route search — down with it.
  const settled = await Promise.allSettled(HORIZON_LIMITS.map(async (maxDays, index) => {
    const minDays = index === 0 ? 0 : HORIZON_LIMITS[index - 1];
    const query = new URLSearchParams({
      active: 'true',
      closed: 'false',
      limit: '100',
      offset: '0',
      order: 'volumeNum',
      ascending: 'false',
      end_date_min: new Date(now + minDays * DAY_MS).toISOString(),
      end_date_max: new Date(now + maxDays * DAY_MS).toISOString(),
      // Topics come from tags, and tags are omitted unless asked for. Sampled
      // across every maturity band, 100% of markets carry at least one.
      include_tag: 'true',
    });
    const response = await fetch(`https://gamma-api.polymarket.com/markets?${query}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      console.warn(`[market-data:polymarket] ${minDays}-${maxDays}d: ${response.status}`);
      return [];
    }
    const value = await responseJson(response);
    return Array.isArray(value) ? value.filter(isRawMarket) : [];
  }));
  const pages = settled.map((result) => {
    if (result.status === 'fulfilled') return result.value;
    console.warn(`[market-data:polymarket] page failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
    return [] as RawMarket[];
  });
  return [...new Map(
    pages.flat().map((market) => [
      market.slug ?? `${market.question}|${market.endDate ?? ''}`,
      market,
    ]),
  ).values()];
}
