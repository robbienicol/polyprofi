import type { PolymarketEntry } from '@/api/client/market-data-types';
import { polymarketMaturityDays } from '@/api/client/polymarket-maturity';
import {
  eventTagSlugs,
  isRawMarket,
  isTradeableRaw,
  toPolymarketEntry,
  withInheritedTags,
  type RawMarket,
} from '@/api/client/polymarket-raw';
import { isRecord, responseJson } from '@/lib/runtime-validation';

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
 * Keyword search for the route list: "Messi", "Tesla", "US Open".
 *
 * The daily snapshot only holds the top ~100 markets per horizon band, so a search
 * that read from it would miss almost everything. Gamma's public-search indexes the
 * whole catalog instead, and this pages through it: an event-heavy query like
 * "us open" is hundreds of events deep, and the tournament markets a user actually
 * wants sit well past the first page.
 *
 * Two things the raw endpoint gets wrong for this use. It happily returns settled
 * markets — every "Messi" hit is closed and priced 0/1 — which would otherwise be
 * offered as a route to buy Yes at 100¢. And it puts tags on the *event* while
 * leaving the markets bare, so a searched market would lose its topic. Both are
 * fixed here rather than at the call site.
 */
const SEARCH_EVENTS_PER_PAGE = 50;
const SEARCH_PAGES = 3;

export async function searchPolymarketByKeyword(keyword: string): Promise<PolymarketEntry[]> {
  const trimmed = keyword.trim();
  if (trimmed.length < 2) return [];

  // allSettled, not all: a failed page must narrow the result, not empty it.
  const settled = await Promise.allSettled(
    Array.from({ length: SEARCH_PAGES }, (_unused, index) => searchPolymarketPage(trimmed, index + 1)),
  );
  const entries = settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));

  // Same sanity floor the goal-scoped universe uses: two-sided, and priced
  // somewhere a position can actually be taken. A 1¢ longshot in a 60-player
  // field is a real market but not a route we can honestly price.
  const tradeable = entries.filter((market) => market.prices.length === 2
    && market.outcomes.length === 2
    && polymarketMaturityDays(market.endDate) != null
    && market.prices.every((price) => Number.isFinite(price) && price >= 0.02 && price <= 0.98));

  return [...new Map(tradeable.map((market) => [market.slug ?? market.question, market])).values()];
}

/** One page of public-search, flattened from events to their open markets. */
async function searchPolymarketPage(keyword: string, page: number): Promise<PolymarketEntry[]> {
  const query = new URLSearchParams({
    q: keyword,
    limit_per_type: String(SEARCH_EVENTS_PER_PAGE),
    events_status: 'active',
    page: String(page),
  });
  try {
    const response = await fetch(`https://gamma-api.polymarket.com/public-search?${query}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      console.warn(`[market-data:polymarket] keyword search p${page}: ${response.status}`);
      return [];
    }
    const value = await responseJson(response);
    if (!isRecord(value) || !Array.isArray(value.events)) return [];

    return value.events.flatMap((event) => {
      if (!isRecord(event) || !Array.isArray(event.markets)) return [];
      // A settled event's markets are all history, whatever their own flags say.
      if (event.closed === true) return [];
      const eventTags = eventTagSlugs(event);
      // An open tournament event still carries settled markets — the players
      // already knocked out, priced 0/1. Those are filtered per market, not per event.
      return event.markets
        .filter((market): market is RawMarket => isRawMarket(market) && isTradeableRaw(market))
        .map((market) => withInheritedTags(toPolymarketEntry(market), eventTags));
    });
  } catch {
    return [];
  }
}
