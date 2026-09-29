import type { KalshiEntry } from '@/api/client/market-data-types';

// Generic (non-sports) Polymarket <-> Kalshi matching. There is no shared roster to
// anchor on here the way sports-market-match.ts anchors on team names, so this
// compares normalized question text and requires a close resolution date on top —
// same "return nothing rather than a wrong answer" bias as the sports matcher: a
// mismatched pair would show a fabricated price gap between two unrelated events,
// which is worse than showing no comparison at all. See sports-market-match.ts's
// header comment for the reported failure this whole family of matchers exists to
// prevent.

export interface GenericMatch {
  polymarketSlug: string;
  // Kalshi models a plain Yes/No proposition on a single ticker — unlike a sports
  // moneyline, which needs one ticker per team — so the same ticker prices both
  // sides and this can reuse SportsMatch's kalshiYesTicker/kalshiNoTicker shape
  // by setting both to it.
  kalshiTicker: string;
}

const STOPWORDS = new Set([
  'will', 'the', 'a', 'an', 'be', 'is', 'are', 'was', 'were', 'been', 'being',
  'in', 'on', 'at', 'to', 'of', 'for', 'by', 'with', 'and', 'or', 'than',
  'before', 'after', 'this', 'that', 'these', 'those', 'next', 'who', 'what',
  'when', 'how', 'does', 'do', 'did', 'has', 'have', 'had', 'win', 'wins',
  'reach', 'hit', 'end', 'ends', 'year', 'yes', 'no',
]);

/** Significant words only — short function words and yes/no carry no identity. */
function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter((word) => word.length >= 3 && !STOPWORDS.has(word)),
  );
}

function overlapCount(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const word of a) if (b.has(word)) count++;
  return count;
}

/** Jaccard similarity: overlap over the combined vocabulary, so a long Kalshi
 * title padded with extra words can't inflate a match off a handful of shared
 * words the way a raw overlap COUNT would. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const shared = overlapCount(a, b);
  return shared / (a.size + b.size - shared);
}

// Deliberately high: two unrelated markets sharing a handful of generic finance/
// politics words ("rate", "president", "election") is common enough that a loose
// threshold would produce real false positives, which the header comment above
// explains is worse than no comparison.
const MIN_JACCARD = 0.6;
const MIN_SHARED_WORDS = 3;
const MAX_DATE_DRIFT_MS = 2 * 24 * 60 * 60 * 1_000; // ±2 days

function closeEnough(aIso: string | undefined, bIso: string | undefined): boolean {
  if (!aIso || !bIso) return false;
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= MAX_DATE_DRIFT_MS;
}

/**
 * One matchable candidate on the Kalshi side: a single ticker with the text that
 * identifies it. For a single-market event that's just the event's own title; for
 * a multi-candidate event (e.g. "Who will the next Pope be?") it's the event title
 * plus the specific candidate's own sub-title, so each nominee compares as its own
 * question rather than all of them collapsing onto one shared event title.
 */
export interface KalshiMatchCandidate {
  ticker: string;
  text: string;
  closeTime?: string;
}

/**
 * Matches a Polymarket Yes/No market against Kalshi's generic (non-sports)
 * markets by question-text similarity plus a close resolution date. Returns null
 * — no comparison shown — unless exactly one Kalshi candidate clears both bars;
 * zero or multiple qualifying candidates are both treated as "not confident
 * enough to guess," the same rule the sports matcher applies to a doubleheader.
 */
export function matchPolymarketToKalshiGeneric(
  polymarket: { slug?: string; question: string; outcomes: string[]; endDate?: string },
  candidates: KalshiMatchCandidate[],
): GenericMatch | null {
  if (!polymarket.slug) return null;
  // Restricted to plain Yes/No propositions — a team-named sports market or an
  // exotic multi-leg combo is out of scope for this matcher (sports has its own,
  // and nothing here can price a combo against a single Kalshi ticker anyway).
  const outcomes = polymarket.outcomes.map((o) => o.trim().toLowerCase());
  if (outcomes.length !== 2 || !outcomes.includes('yes') || !outcomes.includes('no')) return null;

  const questionWords = significantWords(polymarket.question);
  if (questionWords.size === 0) return null;

  const qualifying = candidates.filter((candidate) => {
    if (!closeEnough(polymarket.endDate, candidate.closeTime)) return false;
    const candidateWords = significantWords(candidate.text);
    return overlapCount(questionWords, candidateWords) >= MIN_SHARED_WORDS
      && jaccard(questionWords, candidateWords) >= MIN_JACCARD;
  });

  if (qualifying.length !== 1) return null;
  return { polymarketSlug: polymarket.slug, kalshiTicker: qualifying[0].ticker };
}

/** Flattens Kalshi entries fetched by event into match candidates (see
 * fetchKalshiGenericMarkets) — the event title carries the question, and a
 * nested market's own yes_sub_title refines it for multi-candidate events. */
export function toMatchCandidates(entries: KalshiEntry[]): KalshiMatchCandidate[] {
  return entries.map((entry) => ({
    ticker: entry.ticker,
    text: entry.yesSubTitle ? `${entry.title} ${entry.yesSubTitle}` : entry.title,
    closeTime: entry.expectedExpirationTime ?? entry.closeTime,
  }));
}

export function __selfCheck(): void {
  const fedEvent: KalshiEntry = {
    ticker: 'KXFEDCUT-26SEP-YES',
    eventTicker: 'KXFEDCUT-26SEP',
    seriesTicker: 'KXFEDCUT',
    title: 'Will the Fed cut rates at its September meeting?',
    status: 'open',
    expectedExpirationTime: '2026-09-17T18:00:00Z',
  };
  const unrelated: KalshiEntry = {
    ticker: 'KXWARMING-50-YES',
    eventTicker: 'KXWARMING-50',
    seriesTicker: 'KXWARMING',
    title: 'Will the world pass 2 degrees Celsius of warming before 2050?',
    status: 'open',
    expectedExpirationTime: '2050-01-01T00:00:00Z',
  };
  const candidates = toMatchCandidates([fedEvent, unrelated]);

  const goodMatch = matchPolymarketToKalshiGeneric(
    { slug: 'fed-cuts-september', question: 'Will the Fed cut rates at its September meeting?', outcomes: ['Yes', 'No'], endDate: '2026-09-17T19:00:00Z' },
    candidates,
  );
  console.assert(
    goodMatch?.kalshiTicker === 'KXFEDCUT-26SEP-YES',
    'a near-identical question with a close resolution date should match',
  );

  const dateMismatch = matchPolymarketToKalshiGeneric(
    { slug: 'fed-cuts-later', question: 'Will the Fed cut rates at its September meeting?', outcomes: ['Yes', 'No'], endDate: '2026-12-01T00:00:00Z' },
    candidates,
  );
  console.assert(dateMismatch === null, 'a date far outside the window must not match, even with identical wording');

  const wordMismatch = matchPolymarketToKalshiGeneric(
    { slug: 'unrelated-question', question: 'Will Bitcoin close above $150k in September?', outcomes: ['Yes', 'No'], endDate: '2026-09-17T19:00:00Z' },
    candidates,
  );
  console.assert(wordMismatch === null, 'a close date alone must not match without real word overlap');

  const notYesNo = matchPolymarketToKalshiGeneric(
    { slug: 'lakers-beat-celtics', question: 'Los Angeles Lakers vs. Boston Celtics', outcomes: ['Los Angeles Lakers', 'Boston Celtics'], endDate: '2026-09-17T19:00:00Z' },
    candidates,
  );
  console.assert(notYesNo === null, 'a team-named market (sports) is out of scope for the generic matcher');

  const ambiguousCandidates = toMatchCandidates([
    fedEvent,
    { ...fedEvent, ticker: 'KXFEDCUT-26SEP-ALT', title: 'Will the Fed cut rates at its September policy meeting?' },
  ]);
  const ambiguous = matchPolymarketToKalshiGeneric(
    { slug: 'fed-cuts-september', question: 'Will the Fed cut rates at its September meeting?', outcomes: ['Yes', 'No'], endDate: '2026-09-17T19:00:00Z' },
    ambiguousCandidates,
  );
  console.assert(ambiguous === null, 'two equally-qualifying candidates must not guess — no match');

  const noSlug = matchPolymarketToKalshiGeneric(
    { question: 'Will the Fed cut rates at its September meeting?', outcomes: ['Yes', 'No'], endDate: '2026-09-17T19:00:00Z' },
    candidates,
  );
  console.assert(noSlug === null, 'a route with no source slug (e.g. AI-generated) can never be matched');
}
