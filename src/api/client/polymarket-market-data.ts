import type { PolymarketEntry } from '@/api/client/market-data-types';
import {
  TIMEFRAME_MATURITY_LIMITS,
  timeframeMaturityLimit,
} from '@/lib/quiz-profile';
import { meaningfulTagSlugs } from '@/lib/prediction-topics';
import { isRecord, parseJson, responseJson } from '@/lib/runtime-validation';
import type { RouteParams } from '@/types/routes';

interface RawMarket {
  question: string;
  outcomes: string | string[];
  outcomePrices: string | string[];
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
}

export interface PolymarketSnapshot {
  context: PolymarketEntry[];
  universe: PolymarketEntry[];
}

let rawSnapshotRequest: Promise<RawMarket[]> | null = null;
let rawSnapshotCache: { day: string; markets: RawMarket[] } | null = null;
const DAY_MS = 86_400_000;
const HORIZON_LIMITS = Object.values(TIMEFRAME_MATURITY_LIMITS);

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
  const pages = await Promise.all(HORIZON_LIMITS.map(async (maxDays, index) => {
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
  return [...new Map(
    pages.flat().map((market) => [
      market.slug ?? `${market.question}|${market.endDate ?? ''}`,
      market,
    ]),
  ).values()];
}

/**
 * Exact lookup of specific markets by slug. Deliberately bypasses the shared
 * daily snapshot cache: this backs live position monitoring, where a price from
 * this morning is a wrong price.
 */
export async function fetchPolymarketMarketsBySlug(slugs: string[]): Promise<PolymarketEntry[]> {
  const wanted = [...new Set(slugs.filter(Boolean))];
  if (wanted.length === 0) return [];
  const CHUNK = 20;
  const chunks: string[][] = [];
  for (let index = 0; index < wanted.length; index += CHUNK) {
    chunks.push(wanted.slice(index, index + CHUNK));
  }
  const pages = await Promise.all(chunks.map(async (chunk) => {
    const query = new URLSearchParams({ limit: String(chunk.length) });
    for (const slug of chunk) query.append('slug', slug);
    try {
      const response = await fetch(`https://gamma-api.polymarket.com/markets?${query}`, { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        console.warn(`[market-data:polymarket] slug lookup: ${response.status}`);
        return [];
      }
      const value = await responseJson(response);
      return Array.isArray(value) ? value.filter(isRawMarket).map(toPolymarketEntry) : [];
    } catch {
      return [];
    }
  }));
  return pages.flat();
}

/**
 * Polymarket usually slugifies the question verbatim, so this guesses a market's
 * slug from its question — but only ~2 in 3 match (renamed questions, and
 * disambiguating numeric suffixes like "…-nomination-879"). Callers must verify
 * the returned market's question; a wrong guess must fail, not mis-resolve.
 */
export function polymarketSlugCandidate(question: string): string {
  return question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // "Inácio" → "inacio"
    .replace(/['’.]/g, '') // "U.S." → "us", "O’Rourke" → "orourke"
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Locates specific markets by their question text, for positions tracked before
 * the source slug was persisted. Tries the derived slug first (one batched
 * request), then Gamma's search for whatever is left. Returns candidates only —
 * the caller still requires an exact question match before pricing anything.
 */
export async function fetchPolymarketMarketsByQuestion(questions: string[]): Promise<PolymarketEntry[]> {
  const wanted = [...new Set(questions.filter(Boolean))];
  if (wanted.length === 0) return [];

  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const bySlug = await fetchPolymarketMarketsBySlug(wanted.map(polymarketSlugCandidate));
  const resolved = new Set(bySlug.map((market) => normalize(market.question)));
  const unresolved = wanted.filter((question) => !resolved.has(normalize(question)));

  const searched = await Promise.all(unresolved.map(searchPolymarketMarkets));
  return [...bySlug, ...searched.flat()];
}

/** Gamma's public search, which reaches markets outside the top-volume pages. */
async function searchPolymarketMarkets(question: string): Promise<PolymarketEntry[]> {
  const query = new URLSearchParams({ q: question, limit_per_type: '10' });
  try {
    const response = await fetch(`https://gamma-api.polymarket.com/public-search?${query}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      console.warn(`[market-data:polymarket] search: ${response.status}`);
      return [];
    }
    const value = await responseJson(response);
    if (!isRecord(value) || !Array.isArray(value.events)) return [];
    return value.events.flatMap((event) => {
      if (!isRecord(event) || !Array.isArray(event.markets)) return [];
      const eventTags = eventTagSlugs(event);
      return event.markets
        .filter(isRawMarket)
        .map((market) => withInheritedTags(toPolymarketEntry(market), eventTags));
    });
  } catch {
    return [];
  }
}

/**
 * Keyword search for the route list: "Messi", "Tesla", "Fed".
 *
 * Two things the raw endpoint gets wrong for this use. It happily returns settled
 * markets — every "Messi" hit is closed and priced 0/1 — which would otherwise be
 * offered as a route to buy Yes at 100¢. And it puts tags on the *event* while
 * leaving the markets bare, so a searched market would lose its topic. Both are
 * fixed here rather than at the call site.
 */
export async function searchPolymarketByKeyword(keyword: string): Promise<PolymarketEntry[]> {
  const trimmed = keyword.trim();
  if (trimmed.length < 2) return [];
  const query = new URLSearchParams({ q: trimmed, limit_per_type: '20' });
  try {
    const response = await fetch(`https://gamma-api.polymarket.com/public-search?${query}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      console.warn(`[market-data:polymarket] keyword search: ${response.status}`);
      return [];
    }
    const value = await responseJson(response);
    if (!isRecord(value) || !Array.isArray(value.events)) return [];

    const entries = value.events.flatMap((event) => {
      if (!isRecord(event) || !Array.isArray(event.markets)) return [];
      // A settled event's markets are all history, whatever their own flags say.
      if (event.closed === true) return [];
      const eventTags = eventTagSlugs(event);
      return event.markets
        .filter((market): market is RawMarket => isRawMarket(market) && isTradeableRaw(market))
        .map((market) => withInheritedTags(toPolymarketEntry(market), eventTags));
    });

    // Same sanity floor the goal-scoped universe uses: two-sided, and priced
    // somewhere a position can actually be taken.
    const tradeable = entries.filter((market) => market.prices.length === 2
      && market.outcomes.length === 2
      && polymarketMaturityDays(market.endDate) != null
      && market.prices.every((price) => Number.isFinite(price) && price >= 0.02 && price <= 0.98));

    return [...new Map(tradeable.map((market) => [market.slug ?? market.question, market])).values()];
  } catch {
    return [];
  }
}

function isTradeableRaw(market: RawMarket): boolean {
  const record = market as unknown as Record<string, unknown>;
  return record.closed !== true && record.active !== false;
}

function eventTagSlugs(event: Record<string, unknown>): string[] {
  if (!Array.isArray(event.tags)) return [];
  return meaningfulTagSlugs(
    event.tags.map((tag) => (isRecord(tag) && typeof tag.slug === 'string' ? tag.slug : '')),
  );
}

/** Search results carry tags on the event, so a market with none borrows its event's. */
function withInheritedTags(entry: PolymarketEntry, eventTags: string[]): PolymarketEntry {
  if (entry.tagSlugs?.length || eventTags.length === 0) return entry;
  return { ...entry, tagSlugs: eventTags };
}

export function polymarketMaturityDays(
  endDate: string | undefined,
  now = Date.now(),
): number | null {
  if (!endDate) return null;
  const end = new Date(endDate).getTime();
  if (!Number.isFinite(end) || end <= now) return null;
  return Math.ceil((end - now) / DAY_MS);
}

export function filterPolymarketMarketsForTimeframe(
  markets: PolymarketEntry[],
  timeframe: RouteParams['timeframe'],
  now = Date.now(),
): PolymarketEntry[] {
  const maxDays = timeframeMaturityLimit(timeframe);
  return markets.filter((market) => {
    const days = polymarketMaturityDays(market.endDate, now);
    return days != null && days <= maxDays;
  });
}

export function balancePolymarketUniverse(
  markets: PolymarketEntry[],
  limit: number,
  now = Date.now(),
): PolymarketEntry[] {
  if (limit <= 0) return [];
  const buckets = HORIZON_LIMITS.map(() => [] as PolymarketEntry[]);
  for (const market of markets) {
    const days = polymarketMaturityDays(market.endDate, now);
    if (days == null) continue;
    const bucketIndex = HORIZON_LIMITS.findIndex((maxDays) => days <= maxDays);
    if (bucketIndex >= 0) buckets[bucketIndex].push(market);
  }
  for (const bucket of buckets) bucket.sort((a, b) => b.volumeM - a.volumeM);

  const selected: PolymarketEntry[] = [];
  const used = new Set<string>();
  const quota = Math.floor(limit / buckets.length);
  for (const bucket of buckets) {
    for (const market of bucket.slice(0, quota)) {
      selected.push(market);
      used.add(market.slug ?? market.question);
    }
  }

  const remaining = buckets
    .flat()
    .filter((market) => !used.has(market.slug ?? market.question))
    .sort((a, b) => b.volumeM - a.volumeM);
  return [...selected, ...remaining].slice(0, limit);
}

function toPolymarketEntry(market: RawMarket): PolymarketEntry {
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
