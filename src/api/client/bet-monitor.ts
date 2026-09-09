import { PolymarketEntry, SportsGame } from '@/api/client/market-data';
import { fetchPolymarketMarketsByQuestion, fetchPolymarketMarketsBySlug } from '@/api/client/polymarket-market-data';
import {
  betOutcomeSide,
  effectiveEntryPrice,
  findMarketForBet,
  matchSportsGame,
  monitoredProfitGoal,
  quotedQuestion,
  resolveOutcomePrice,
  sportsScoreMargin,
} from '@/lib/bet-monitor-match';
import { isPredictionMarketBet } from '@/lib/parse-bet-line';
import { isRecord, responseJson } from '@/lib/runtime-validation';
import { BetLiveStatus, TrackedBet } from '@/types/bets';

const ESPN_SPORTS = [
  { key: 'basketball/nba', label: 'NBA' },
  { key: 'football/nfl', label: 'NFL' },
  { key: 'baseball/mlb', label: 'MLB' },
  { key: 'hockey/nhl', label: 'NHL' },
  { key: 'soccer/usa.1', label: 'MLS' },
  { key: 'soccer/eng.1', label: 'EPL' },
] as const;

/**
 * The markets the tracked positions are actually on: looked up by stored slug,
 * or by the question quoted in the description for positions tracked before the
 * slug was persisted. Both are targeted lookups — scanning a page of top-volume
 * markets misses anything outside it, and a $9M election market is easily
 * outside Gamma's first 100. No fuzzy matching: see @/lib/bet-monitor-match.
 */
async function fetchMarketsForBets(bets: TrackedBet[]): Promise<PolymarketEntry[]> {
  const predictionBets = bets.filter(isPredictionMarketBet);
  if (predictionBets.length === 0) return [];
  const slugs = predictionBets.flatMap((bet) => (bet.sourceSlug ? [bet.sourceSlug] : []));
  const questions = predictionBets.flatMap((bet) => {
    if (bet.sourceSlug) return [];
    const question = quotedQuestion(bet.description);
    return question ? [question] : [];
  });
  const [bySlug, byQuestion] = await Promise.all([
    fetchPolymarketMarketsBySlug(slugs),
    fetchPolymarketMarketsByQuestion(questions),
  ]);
  const found = [...bySlug, ...byQuestion];

  // A stored slug can go stale (Polymarket renames a market, which changes its
  // slug). Retry those by question text rather than dropping the price.
  const stale = predictionBets.flatMap((bet) => {
    if (findMarketForBet(bet, found)) return [];
    const question = quotedQuestion(bet.description);
    return question ? [question] : [];
  });
  return stale.length > 0 ? [...found, ...await fetchPolymarketMarketsByQuestion(stale)] : found;
}

async function fetchLiveSports(): Promise<SportsGame[]> {
  const today = new Date();
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const dateRange = fmt(today);

  const results = await Promise.allSettled(
    ESPN_SPORTS.map(async ({ key, label }) => {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/${key}/scoreboard?dates=${dateRange}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) return [];

      const payload = await responseJson(res);
      const events = isRecord(payload) && Array.isArray(payload.events) ? payload.events : [];
      return events.flatMap((event) => {
        if (!isRecord(event) || !Array.isArray(event.competitions) || !isRecord(event.competitions[0])) return [];
        const competition = event.competitions[0];
        const competitors = Array.isArray(competition.competitors) ? competition.competitors.filter(isEspnCompetitor) : [];
        const home = competitors.find((competitor) => competitor.homeAway === 'home');
        const away = competitors.find((competitor) => competitor.homeAway === 'away');
        const status = isRecord(competition.status) && isRecord(competition.status.type) ? competition.status.type : null;
        return {
          sport: label,
          home: home?.team.displayName ?? '',
          away: away?.team.displayName ?? '',
          date: '',
          status: typeof status?.description === 'string' ? status.description : '',
          homeScore: home?.score ? Number(home.score) : undefined,
          awayScore: away?.score ? Number(away.score) : undefined,
          state: typeof status?.state === 'string' ? status.state : '',
        };
      });
    })
  );

  return results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
}

function isEspnCompetitor(value: unknown): value is { homeAway: string; team: { displayName: string }; score?: string } {
  return isRecord(value)
    && typeof value.homeAway === 'string'
    && isRecord(value.team)
    && typeof value.team.displayName === 'string'
    && (value.score === undefined || typeof value.score === 'string');
}

function calcPolymarketPnl(amountWagered: number, entryPrice: number, currentPrice: number): number {
  if (entryPrice <= 0) return 0;
  const shares = amountWagered / entryPrice;
  return shares * currentPrice - amountWagered;
}

async function fetchBetLiveStatus(bet: TrackedBet, markets?: PolymarketEntry[], games?: SportsGame[]): Promise<BetLiveStatus> {
  const entryPrice = effectiveEntryPrice(bet);
  const profitGoal = monitoredProfitGoal(bet, entryPrice);
  const side = betOutcomeSide(bet);
  const isPoly = isPredictionMarketBet(bet);

  const base: BetLiveStatus = {
    betId: bet.id,
    unrealizedPnl: 0,
    entryPrice: entryPrice ?? undefined,
    profitGoal,
    profitGoalHit: false,
    sellRecommended: false,
    reason: 'Monitoring…',
    isLive: false,
    fetchedAt: new Date().toISOString(),
  };

  if (bet.status !== 'active') {
    return { ...base, reason: 'Bet settled' };
  }

  const [polyMarkets, liveGames] = await Promise.all([
    isPoly ? (markets ?? fetchMarketsForBets([bet])) : Promise.resolve([]),
    games ?? fetchLiveSports(),
  ]);

  const game = matchSportsGame(bet, liveGames);
  let liveContext: string | undefined;
  let gameStatus: string | undefined;
  let isLive = false;

  if (game) {
    gameStatus = game.status;
    isLive = game.status.toLowerCase().includes('progress') || game.status.toLowerCase().includes('half');
    const score =
      game.homeScore !== undefined && game.awayScore !== undefined
        ? `${game.away} ${game.awayScore} – ${game.homeScore} ${game.home}`
        : `${game.away} @ ${game.home}`;
    liveContext = `${score} · ${game.status}`;

    const margin = sportsScoreMargin(game, side);
    if (margin !== null && margin >= 15 && isPoly && entryPrice) {
      // Strong in-game lead → contract likely repriced well above entry; nudge check even before price fetch.
      base.reason = `Your pick is up ${margin} — contract may have hit your $${profitGoal} target`;
    }
  }

  if (isPoly && entryPrice) {
    const market = findMarketForBet(bet, polyMarkets);
    const currentPrice = market ? resolveOutcomePrice(market, side) : null;
    if (currentPrice != null) {
      const unrealizedPnl = calcPolymarketPnl(bet.amountWagered, entryPrice, currentPrice);
      const profitGoalHit = unrealizedPnl >= profitGoal;
      const sellRecommended = profitGoalHit && !bet.sellAlertDismissed;

      let reason: string;
      if (profitGoalHit) {
        reason = `Up $${unrealizedPnl.toFixed(0)} — your $${profitGoal} goal is hit. Sell now to lock it in.`;
      } else if (liveContext) {
        reason = `${liveContext}. Contract at ${(currentPrice * 100).toFixed(0)}¢ (entry ${(entryPrice * 100).toFixed(0)}¢). Need +$${Math.max(0, profitGoal - unrealizedPnl).toFixed(0)} more.`;
      } else {
        reason = `Contract at ${(currentPrice * 100).toFixed(0)}¢ (entry ${(entryPrice * 100).toFixed(0)}¢) · ${unrealizedPnl >= 0 ? 'up' : 'down'} $${Math.abs(unrealizedPnl).toFixed(0)} of $${profitGoal} goal`;
      }

      return {
        ...base,
        currentPrice,
        unrealizedPnl,
        profitGoalHit,
        sellRecommended,
        reason,
        liveContext,
        gameStatus,
        homeScore: game?.homeScore,
        awayScore: game?.awayScore,
        isLive: isLive || profitGoalHit,
      };
    }
  }

  if (liveContext) {
    return {
      ...base,
      reason: liveContext,
      liveContext,
      gameStatus,
      homeScore: game?.homeScore,
      awayScore: game?.awayScore,
      isLive,
    };
  }

  return {
    ...base,
    // Say which half is missing rather than implying a refresh will fix a
    // position we can't identify at all — the old copy hid a wrong price behind
    // "pull to refresh"; now an unidentifiable market reports no price instead.
    reason: !isPoly
      ? 'No live event found yet — pull to refresh'
      : !entryPrice || !side
        ? 'No entry price recorded for this position — live P&L unavailable'
        : 'No live price for this market yet — pull to refresh',
  };
}

export async function fetchAllBetStatuses(bets: TrackedBet[]): Promise<BetLiveStatus[]> {
  const active = bets.filter((b) => b.status === 'active');
  if (active.length === 0) return [];

  const [markets, games] = await Promise.all([
    fetchMarketsForBets(active),
    fetchLiveSports(),
  ]);

  return Promise.all(active.map((bet) => fetchBetLiveStatus(bet, markets, games)));
}
