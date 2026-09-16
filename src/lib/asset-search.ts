import { CRYPTO_ALIASES, CRYPTO_UNIVERSE } from '@/lib/crypto-routes';
import { ETF_UNIVERSE } from '@/lib/etf-routes';

/**
 * Resolving a typed search to the tradeable assets we actually cover.
 *
 * The prediction side of search reaches the whole Polymarket catalog, because
 * Polymarket indexes it for us. The asset side cannot: stocks, funds, treasuries and
 * coins come from curated universes, chosen so every route on the map has a vetted
 * risk level and an honest volatility basis. So "search everything" here means
 * "search everything we cover", and anything outside it has to be said out loud
 * rather than silently returning nothing — see assetSearchCoverage.
 */

/**
 * Words that describe the *kind* of thing rather than the thing. "doge coin" and
 * "tesla stock" have to reach DOGE and TSLA, and the noun is never the part that
 * identifies them.
 *
 * Deliberately NOT here: "bond", "treasury", "gold" and friends. They look like kind
 * words but they are the only thing separating BND from VOO, so dropping them would
 * turn "vanguard bond" into "everything Vanguard".
 */
const KIND_WORDS = new Set([
  'coin', 'coins', 'crypto', 'cryptocurrency', 'token', 'tokens',
  'stock', 'stocks', 'share', 'shares',
  'etf', 'etfs', 'fund', 'funds',
  'the', 'a', 'an', 'of', 'and',
]);

export interface AssetCandidate {
  /** Yahoo symbol to quote, e.g. 'DOGE-USD'. */
  symbol: string;
  /** Everything a search may legitimately match on, lowercased. */
  terms: string[];
}

/** The full searchable surface of the curated asset universes. */
export function assetCandidates(): AssetCandidate[] {
  const etfs = ETF_UNIVERSE.map((etf) => ({
    symbol: etf.symbol,
    terms: [etf.symbol, etf.name, etf.bucket, ...(etf.issuer ? [etf.issuer] : [])].map(lower),
  }));
  const crypto = CRYPTO_UNIVERSE.map((coin) => ({
    symbol: coin.symbol,
    terms: [coin.symbol, coin.ticker, coin.name, ...(CRYPTO_ALIASES[coin.symbol] ?? [])].map(lower),
  }));
  return [...etfs, ...crypto];
}

/**
 * Meaningful search words: lowercased, punctuation-stripped, kind-words dropped.
 * Returns empty when the query is *only* kind words ("crypto"), which is a browse
 * request rather than a lookup and should not resolve to some arbitrary coin.
 */
export function assetSearchWords(keyword: string): string[] {
  return keyword
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0 && !KIND_WORDS.has(word));
}

/**
 * Symbols in the curated universes that a typed search names. Every meaningful word
 * must appear somewhere in the asset's terms, so "vanguard bond" narrows to BND/BNDX
 * rather than widening to everything Vanguard. Capped: a broad word like "us" would
 * otherwise pull the whole universe into an on-demand quote fetch.
 */
export const MAX_ASSET_MATCHES = 8;

export function matchAssetSymbols(keyword: string, candidates = assetCandidates()): string[] {
  const words = assetSearchWords(keyword);
  if (words.length === 0) return [];
  const matches = candidates.filter((candidate) =>
    words.every((word) => candidate.terms.some((term) => termContains(term, word))),
  );
  return matches.slice(0, MAX_ASSET_MATCHES).map((candidate) => candidate.symbol);
}

/**
 * Whether a term answers a search word. A ticker must match whole ("VOO" is not a hit
 * for "V") while a longer name matches on substring, so "vanguard" finds "Vanguard
 * Total Bond Market ETF" without "v" finding all of it.
 */
function termContains(term: string, word: string): boolean {
  if (word.length < 3) return term.split(/[\s-]+/).includes(word);
  return term.includes(word);
}

function lower(value: string): string {
  return value.toLowerCase();
}

// ── self-check ──────────────────────────────────────────────────────────────
export function __selfCheck(): void {
  console.assert(matchAssetSymbols('doge coin').includes('DOGE-USD'), '"doge coin" resolves to Dogecoin');
  console.assert(matchAssetSymbols('dogecoin').includes('DOGE-USD'), 'the one-word spelling resolves too');
  console.assert(matchAssetSymbols('DOGE').includes('DOGE-USD'), 'a bare ticker resolves');
  console.assert(matchAssetSymbols('bitcoin').includes('BTC-USD'), 'a coin is findable by name, not just ticker');
  console.assert(matchAssetSymbols('voo').includes('VOO'), 'a fund resolves by ticker, case-insensitively');
  console.assert(matchAssetSymbols('gold').includes('GLD'), 'a fund resolves by what it holds');
  console.assert(
    matchAssetSymbols('tesla').length === 0 || matchAssetSymbols('tesla').every((symbol) => symbol === 'TSLA'),
    'a single-name search resolves to that name or to nothing — never to a neighbour',
  );

  console.assert(matchAssetSymbols('crypto').length === 0, '"crypto" alone is a browse, not a lookup');
  console.assert(matchAssetSymbols('   ').length === 0, 'whitespace resolves to nothing');
  console.assert(matchAssetSymbols('us open').length === 0, 'a sports event does not resolve to an asset');
  console.assert(
    matchAssetSymbols('zzzzz').length === 0,
    'an asset we do not cover resolves to nothing rather than a near-miss',
  );

  console.assert(
    assetSearchWords('Tesla Stock').join(',') === 'tesla',
    'kind words are dropped and the rest lowercased',
  );

  const bonds = matchAssetSymbols('vanguard bond');
  console.assert(
    bonds.length > 0 && bonds.every((symbol) => symbol === 'BND' || symbol === 'BNDX'),
    'every word must match, so "vanguard bond" excludes Vanguard equity funds',
  );
  console.assert(
    matchAssetSymbols('us').length <= MAX_ASSET_MATCHES,
    'a broad word cannot pull an unbounded number of symbols into a quote fetch',
  );
}
