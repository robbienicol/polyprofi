import type { PolymarketEntry } from '@/api/client/market-data-types';
import { parseJson, responseJson } from '@/lib/runtime-validation';

interface RawMarket {
  question: string;
  outcomes: string | string[];
  outcomePrices: string | string[];
  volumeNum: number | null;
  liquidityNum?: number | null;
  slug?: string;
  endDate?: string;
}

export interface PolymarketSnapshot {
  context: PolymarketEntry[];
  universe: PolymarketEntry[];
}

let rawSnapshotRequest: Promise<RawMarket[]> | null = null;

export async function fetchPolymarket(): Promise<PolymarketEntry[]> {
  return (await fetchPolymarketSnapshot()).context;
}

export async function fetchPolymarketUniverse(limit = 240): Promise<PolymarketEntry[]> {
  return (await fetchPolymarketSnapshot(limit)).universe;
}

export async function fetchPolymarketSnapshot(universeLimit = 240): Promise<PolymarketSnapshot> {
  const raw = await fetchSharedPolymarketRaw();
  const context = selectPolymarketContext(raw);
  const universe = selectPolymarketUniverse(raw, universeLimit);
  console.log(`[market-data:polymarket] ${raw.length} fetched, ${context.length} context, ${universe.length} universe`);
  return { context, universe };
}

async function fetchSharedPolymarketRaw(): Promise<RawMarket[]> {
  if (rawSnapshotRequest) return rawSnapshotRequest;
  rawSnapshotRequest = fetchPolymarketRaw(500).finally(() => {
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
  return raw
    .map(toPolymarketEntry)
    .filter((market) => market.prices.length === 2
      && market.outcomes.length === 2
      && market.volumeM >= 0.001
      && market.prices.every((price) => Number.isFinite(price) && price >= 0.02 && price <= 0.98))
    .sort((a, b) => b.volumeM - a.volumeM)
    .slice(0, limit);
}

async function fetchPolymarketRaw(limit: number): Promise<RawMarket[]> {
  const pageSize = 100;
  const offsets = Array.from({ length: Math.ceil(limit / pageSize) }, (_, index) => index * pageSize);
  const pages = await Promise.all(offsets.map(async (offset) => {
    const pageLimit = Math.min(pageSize, limit - offset);
    const response = await fetch(`https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=${pageLimit}&offset=${offset}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      console.warn(`[market-data:polymarket] markets offset=${offset}: ${response.status}`);
      return [];
    }
    const value = await responseJson(response);
    return Array.isArray(value) ? value.filter(isRawMarket) : [];
  }));
  return pages.flat().slice(0, limit);
}

function toPolymarketEntry(market: RawMarket): PolymarketEntry {
  const outcomes = parseStringArray(market.outcomes);
  return {
    question: market.question,
    outcomes: outcomes.length > 0 ? outcomes : ['Yes', 'No'],
    prices: parseStringArray(market.outcomePrices).map(Number),
    volumeM: (market.volumeNum ?? 0) / 1e6,
    liquidityM: (market.liquidityNum ?? 0) / 1e6,
    slug: market.slug,
    endDate: market.endDate,
  };
}

function parseStringArray(value: string | string[]): string[] {
  if (Array.isArray(value)) return value.map(String);
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

function isRawMarket(value: unknown): value is RawMarket {
  if (typeof value !== 'object' || value === null) return false;
  const market = value as Record<string, unknown>;
  return typeof market.question === 'string'
    && (typeof market.outcomes === 'string' || Array.isArray(market.outcomes))
    && (typeof market.outcomePrices === 'string' || Array.isArray(market.outcomePrices))
    && (market.volumeNum === null || typeof market.volumeNum === 'number');
}
