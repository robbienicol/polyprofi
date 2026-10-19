import type { PolymarketEntry } from '@/api/client/market-data-types';
import { meaningfulTagSlugs } from '@/lib/prediction-topics';
import { isRecord, parseJson } from '@/lib/runtime-validation';

export interface RawMarket {
  question: string;
  outcomes: string | string[];
  outcomePrices: string | string[];
  /** CLOB token per outcome, same order as `outcomes`. Keys the price-history API. */
  clobTokenIds?: string | string[] | null;
  volumeNum: number | null;
  liquidityNum?: number | null;
  spread?: number | null;
  bestBid?: number | null;
  bestAsk?: number | null;
  oneDayPriceChange?: number | null;
  oneWeekPriceChange?: number | null;
  oneMonthPriceChange?: number | null;
  slug?: string;
  endDate?: string | null;
  /** Present only because we request include_tag=true; see fetchPolymarketRaw. */
  tags?: { slug?: string }[] | null;
  closed?: boolean;
}

export function isTradeableRaw(market: RawMarket): boolean {
  const record = market as unknown as Record<string, unknown>;
  return record.closed !== true && record.active !== false;
}

export function eventTagSlugs(event: Record<string, unknown>): string[] {
  if (!Array.isArray(event.tags)) return [];
  return meaningfulTagSlugs(
    event.tags.map((tag) => (isRecord(tag) && typeof tag.slug === 'string' ? tag.slug : '')),
  );
}

/** Search results carry tags on the event, so a market with none borrows its event's. */
export function withInheritedTags(entry: PolymarketEntry, eventTags: string[]): PolymarketEntry {
  if (entry.tagSlugs?.length || eventTags.length === 0) return entry;
  return { ...entry, tagSlugs: eventTags };
}

export function toPolymarketEntry(market: RawMarket): PolymarketEntry {
  const outcomes = parseStringArray(market.outcomes);
  return {
    question: market.question,
    outcomes: outcomes.length > 0 ? outcomes : ['Yes', 'No'],
    prices: parseStringArray(market.outcomePrices).map(Number),
    volumeM: (market.volumeNum ?? 0) / 1e6,
    liquidityM: (market.liquidityNum ?? 0) / 1e6,
    spread: finiteOptional(market.spread),
    bestBid: finiteOptional(market.bestBid),
    bestAsk: finiteOptional(market.bestAsk),
    oneDayPriceChange: finiteOptional(market.oneDayPriceChange),
    oneWeekPriceChange: finiteOptional(market.oneWeekPriceChange),
    oneMonthPriceChange: finiteOptional(market.oneMonthPriceChange),
    slug: market.slug,
    endDate: typeof market.endDate === 'string' ? market.endDate : undefined,
    tagSlugs: tagSlugsOf(market),
    closed: market.closed === true,
    clobTokenIds: market.clobTokenIds ? parseStringArray(market.clobTokenIds) : undefined,
  };
}

/** Tag slugs as plain strings, with Polymarket's bookkeeping tags dropped. */
function tagSlugsOf(market: RawMarket): string[] | undefined {
  if (!Array.isArray(market.tags)) return undefined;
  const slugs = meaningfulTagSlugs(
    market.tags.map((tag) => (typeof tag?.slug === 'string' ? tag.slug : '')),
  );
  return slugs.length > 0 ? slugs : undefined;
}

function finiteOptional(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function parseStringArray(value: string | string[]): string[] {
  if (Array.isArray(value)) return value.map(String);
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

export function isRawMarket(value: unknown): value is RawMarket {
  if (typeof value !== 'object' || value === null) return false;
  const market = value as Record<string, unknown>;
  return typeof market.question === 'string'
    && (typeof market.outcomes === 'string' || Array.isArray(market.outcomes))
    && (typeof market.outcomePrices === 'string' || Array.isArray(market.outcomePrices))
    && (market.volumeNum === null || typeof market.volumeNum === 'number');
}
