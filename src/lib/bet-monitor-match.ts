import type { PolymarketEntry, SportsGame } from '@/api/client/market-data-types';
import { isPredictionMarketBet, parseEntryPrice } from '@/lib/parse-bet-line';
import type { TrackedBet } from '@/types/bets';

// Identity resolution for live position monitoring. Everything here is biased
// toward returning NOTHING rather than a wrong answer: a fabricated live price
// or a mismatched game feeds straight into the P&L the user reads off the card
// (and into portfolio-progress), so a wrong match is far worse than a missing one.
//
// The reported failure this exists to prevent: a "Buy No on 'Will Renan Santos
// win the 2026 Brazilian presidential election?'" position showed an
// Orioles–Twins score and −$756 unrealized. The old matcher accepted ANY token
// as a SUBSTRING, and "win" is a substring of "Twins"; the price came from
// whichever unrelated market shared one generic word ("will", "win", "market").

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function wordSet(value: string): Set<string> {
  return new Set(normalizeText(value).split(' ').filter(Boolean));
}

/**
 * Words that carry no team identity. `city`/`united`/`real` are shared across
 * clubs (Manchester United/City), so dropping them makes same-city fixtures tie
 * on score and fall out as ambiguous — which is the outcome we want.
 */
const NON_TEAM_WORDS = new Set([
  'city', 'united', 'real', 'club', 'team', 'game', 'match', 'league', 'cup', 'final',
  'series', 'state', 'north', 'south', 'east', 'west', 'the', 'and',
]);

function teamWords(displayName: string): string[] {
  return [...wordSet(displayName)].filter((word) => word.length >= 4 && !NON_TEAM_WORDS.has(word));
}

function teamHits(haystack: Set<string>, displayName: string): number {
  return teamWords(displayName).filter((word) => haystack.has(word)).length;
}

/** The market question a Polymarket route description quotes: Buy No on “…” at 92¢. */
export function quotedQuestion(description?: string): string | null {
  if (!description) return null;
  const match = description.match(/[“"']([^”"']{8,})[”"']/);
  return match ? match[1].trim() : null;
}

/**
 * Which outcome the user actually bought ("No", "Los Angeles Lakers", …).
 * Stored on the bet since routes carry it, with parses of the line and the
 * description as fallbacks for positions tracked before it was persisted.
 */
export function betOutcomeSide(bet: { outcomeSide?: string; line?: string; description?: string }): string | null {
  if (bet.outcomeSide?.trim()) return bet.outcomeSide.trim();
  const fromLine = bet.line?.replace(/\s*\d+(?:\.\d+)?\s*¢\s*$/, '').trim();
  if (fromLine) return fromLine;
  const fromDescription = bet.description?.match(/^\s*(?:buy|sell|trade)\s+(.+?)\s+on\s+[“"']/i);
  return fromDescription ? fromDescription[1].trim() : null;
}

/**
 * The live price of the side the user bought. Requires an exact outcome-name
 * match — pricing a "No" position off the "Yes" column inverts the P&L, which
 * is how a flat 92¢ position read as −$756.
 */
export function resolveOutcomePrice(market: PolymarketEntry, side: string | null): number | null {
  if (!side) return null;
  const wanted = normalizeText(side);
  if (!wanted) return null;
  const index = market.outcomes.findIndex((outcome) => normalizeText(outcome) === wanted);
  if (index < 0) return null;
  const price = market.prices[index];
  return typeof price === 'number' && Number.isFinite(price) && price > 0 && price < 1 ? price : null;
}

/**
 * The CLOB token for the side the user bought — what its price history is keyed
 * on. Same exact-name rule as the live price, for the same reason.
 */
export function outcomeTokenId(market: PolymarketEntry, side: string | null): string | null {
  if (!side || !market.clobTokenIds) return null;
  const wanted = normalizeText(side);
  const index = market.outcomes.findIndex((outcome) => normalizeText(outcome) === wanted);
  return index >= 0 ? market.clobTokenIds[index] ?? null : null;
}

/**
 * The market this bet is actually on — by stored slug, else by exact question
 * text. Deliberately no fuzzy fallback: an approximate market is a wrong price.
 */
export function findMarketForBet(
  bet: { sourceSlug?: string; description?: string },
  markets: PolymarketEntry[],
): PolymarketEntry | null {
  if (bet.sourceSlug) {
    const bySlug = markets.find((market) => market.slug === bet.sourceSlug);
    if (bySlug) return bySlug;
  }
  const question = quotedQuestion(bet.description);
  if (!question) return null;
  const wanted = normalizeText(question);
  return markets.find((market) => normalizeText(market.question) === wanted) ?? null;
}

/**
 * The live game a sports bet is on. Requires BOTH teams to be named in the bet
 * text by a whole significant word, and requires a single best candidate —
 * so a non-sports market can't pick up a scoreboard at all.
 */
export function matchSportsGame(
  bet: { description?: string; line?: string; monitorQuery?: string },
  games: SportsGame[],
): SportsGame | null {
  const haystack = wordSet([bet.description, bet.line, bet.monitorQuery].filter(Boolean).join(' '));
  if (haystack.size === 0) return null;

  let best: { game: SportsGame; score: number } | null = null;
  let tied = false;
  for (const game of games) {
    const home = teamHits(haystack, game.home);
    const away = teamHits(haystack, game.away);
    if (home === 0 || away === 0) continue; // one team named is a coincidence, not a match
    const score = home + away;
    if (!best || score > best.score) {
      best = { game, score };
      tied = false;
    } else if (score === best.score) {
      tied = true;
    }
  }
  return best && !tied ? best.game : null;
}

/**
 * Win/lost once Polymarket has actually settled the market — not a price
 * guess while it is still trading. `resolveOutcomePrice` deliberately rejects
 * 0 and 1 as degenerate live quotes, so this reads the raw settled price
 * directly and requires `closed` before trusting it: an in-flight market that
 * has merely drifted to 99¢ is not the same thing as one UMA has resolved.
 */
export function resolvedPolymarketOutcome(market: PolymarketEntry, side: string | null): 'won' | 'lost' | null {
  if (!market.closed || !side) return null;
  const wanted = normalizeText(side);
  if (!wanted) return null;
  const index = market.outcomes.findIndex((outcome) => normalizeText(outcome) === wanted);
  if (index < 0) return null;
  const price = market.prices[index];
  if (!Number.isFinite(price)) return null;
  if (price >= 0.99) return 'won';
  if (price <= 0.01) return 'lost';
  // Closed but not cleanly settled to 0/1 yet (e.g. still in UMA dispute) —
  // leave it for the next poll rather than guess.
  return null;
}

/**
 * Win/lost for a sports pick once the game is actually over. Gated on ESPN's
 * own phase rather than the score alone — a live blowout is not a result.
 */
export function resolvedSportsOutcome(game: SportsGame, side: string | null): 'won' | 'lost' | null {
  if (game.state !== 'post') return null;
  const margin = sportsScoreMargin(game, side);
  if (margin == null || margin === 0) return null; // a tie/push is not ours to call automatically
  return margin > 0 ? 'won' : 'lost';
}

/**
 * How far ahead the side the user bought is, or null when the bet doesn't pick
 * exactly one of these two teams (an over/under, a draw, an unrecognized name).
 */
export function sportsScoreMargin(game: SportsGame, side: string | null): number | null {
  if (!side || game.homeScore === undefined || game.awayScore === undefined) return null;
  const picked = wordSet(side);
  const home = teamHits(picked, game.home);
  const away = teamHits(picked, game.away);
  if (home > 0 && away === 0) return game.homeScore - game.awayScore;
  if (away > 0 && home === 0) return game.awayScore - game.homeScore;
  return null;
}

/** Entry price 0–1 for a prediction-market position, from the stored price, the line, or the odds. */
export function effectiveEntryPrice(bet: { entryPrice?: number; line?: string; probability: number }): number | null {
  if (bet.entryPrice && bet.entryPrice > 0 && bet.entryPrice < 1) return bet.entryPrice;
  const parsed = parseEntryPrice(bet.line);
  if (parsed && parsed > 0 && parsed < 1) return parsed;
  if (bet.probability > 0 && bet.probability < 100) return bet.probability / 100;
  return null;
}

/**
 * Most this position can make if it resolves in the user's favour, at the amount
 * actually staked. `expectedReturn` can't stand in for it: that was computed
 * from the quiz balance at route-build time, not from what the user staked.
 */
export function maxAchievableProfit(bet: TrackedBet, entryPrice: number | null): number | null {
  if (!isPredictionMarketBet(bet) || entryPrice == null) return null;
  if (entryPrice <= 0 || entryPrice >= 1 || bet.amountWagered <= 0) return null;
  return bet.amountWagered * (1 / entryPrice - 1);
}

/** The "target" shown on the position card: its real ceiling where we can compute one. */
export function positionTargetProfit(bet: TrackedBet, entryPrice: number | null): number {
  const ceiling = maxAchievableProfit(bet, entryPrice);
  return ceiling == null ? bet.expectedReturn : Math.max(1, Math.round(ceiling));
}

/**
 * The goal this position is monitored against. Capped at what the position can
 * actually pay: a $1,000 stake at 92¢ tops out at +$87, so tracking it toward a
 * $100 quiz target asks for $856 more than the contract can ever return.
 */
export function monitoredProfitGoal(bet: TrackedBet, entryPrice: number | null): number {
  const requested = (bet.profitGoal ?? 0) > 0 ? bet.profitGoal! : bet.expectedReturn;
  const ceiling = maxAchievableProfit(bet, entryPrice);
  return ceiling == null ? requested : Math.min(requested, Math.max(1, Math.round(ceiling)));
}

export { __selfCheck } from '@/lib/bet-monitor-match.check';
