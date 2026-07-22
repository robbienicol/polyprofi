import { PolymarketEntry, SportsGame } from '@/api/client/market-data';
import { extractMonitorTokens, isPredictionMarketBet, parseEntryPrice } from '@/lib/parse-bet-line';
import { isRecord, parseJson, responseJson } from '@/lib/runtime-validation';
import { BetLiveStatus, TrackedBet } from '@/types/bets';

const ESPN_SPORTS = [
  { key: 'basketball/nba', label: 'NBA' },
  { key: 'football/nfl', label: 'NFL' },
  { key: 'baseball/mlb', label: 'MLB' },
  { key: 'hockey/nhl', label: 'NHL' },
  { key: 'soccer/usa.1', label: 'MLS' },
  { key: 'soccer/eng.1', label: 'EPL' },
] as const;

function tokensMatch(text: string, queryTokens: string[]): boolean {
  if (queryTokens.length === 0) return false;
  const hay = text.toLowerCase();
  return queryTokens.some((t) => hay.includes(t));
}

function scoreMargin(home: number, away: number, favoredTokens: string[], homeName: string, awayName: string): number | null {
  const favorsHome = favoredTokens.some((t) => homeName.toLowerCase().includes(t));
  const favorsAway = favoredTokens.some((t) => awayName.toLowerCase().includes(t));
  if (favorsHome && !favorsAway) return home - away;
  if (favorsAway && !favorsHome) return away - home;
  return null;
}

async function fetchPolymarketMarkets(): Promise<PolymarketEntry[]> {
  try {
    const res = await fetch(
      'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=200',
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return [];

    interface RawMarket {
      question: string;
      outcomes: string | string[];
      outcomePrices: string | string[];
    }

    const asArray = (raw: string | string[] | undefined): string[] => {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw.map(String);
      const parsed = parseJson(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    };

    const payload = await responseJson(res);
    const raw = Array.isArray(payload)
      ? payload.filter((market): market is RawMarket => isRecord(market)
          && typeof market.question === 'string'
          && (typeof market.outcomes === 'string' || Array.isArray(market.outcomes))
          && (typeof market.outcomePrices === 'string' || Array.isArray(market.outcomePrices)))
      : [];
    return raw
      .map((m) => {
        const prices = asArray(m.outcomePrices).map(Number);
        const outcomes = asArray(m.outcomes);
        return { m, prices, outcomes };
      })
      .filter(({ prices }) => prices.length > 0)
      .map(({ m, prices, outcomes }) => ({
        question: m.question,
        outcomes: outcomes.length > 0 ? outcomes : ['Yes', 'No'],
        prices,
        volumeM: 0,
      }));
  } catch {
    return [];
  }
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

function findPolymarketPrice(markets: PolymarketEntry[], queryTokens: string[]): { price: number; question: string } | null {
  let best: { price: number; question: string; score: number } | null = null;

  for (const m of markets) {
    const hits = queryTokens.filter((t) => m.question.toLowerCase().includes(t)).length;
    if (hits === 0) continue;
    const yes = m.prices[0];
    if (typeof yes !== 'number' || yes <= 0 || yes >= 1) continue;
    const score = hits / queryTokens.length;
    if (!best || score > best.score) best = { price: yes, question: m.question, score };
  }

  return best ? { price: best.price, question: best.question } : null;
}

function findLiveGame(games: SportsGame[], queryTokens: string[]): SportsGame | null {
  for (const g of games) {
    const blob = `${g.home} ${g.away} ${g.sport}`;
    if (tokensMatch(blob, queryTokens)) return g;
  }
  return null;
}

function calcPolymarketPnl(amountWagered: number, entryPrice: number, currentPrice: number): number {
  if (entryPrice <= 0) return 0;
  const shares = amountWagered / entryPrice;
  return shares * currentPrice - amountWagered;
}

function effectiveProfitGoal(bet: TrackedBet): number {
  return bet.profitGoal != null && bet.profitGoal > 0 ? bet.profitGoal : bet.expectedReturn;
}

function effectiveEntryPrice(bet: TrackedBet): number | null {
  if (bet.entryPrice && bet.entryPrice > 0 && bet.entryPrice < 1) return bet.entryPrice;
  const parsed = parseEntryPrice(bet.line);
  if (parsed && parsed > 0 && parsed < 1) return parsed;
  if (bet.probability > 0) return bet.probability / 100;
  return null;
}

async function fetchBetLiveStatus(bet: TrackedBet, markets?: PolymarketEntry[], games?: SportsGame[]): Promise<BetLiveStatus> {
  const profitGoal = effectiveProfitGoal(bet);
  const entryPrice = effectiveEntryPrice(bet);
  const queryTokens = extractMonitorTokens(bet.description, bet.line, bet.monitorQuery);
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
    isPoly ? (markets ?? fetchPolymarketMarkets()) : Promise.resolve([]),
    games ?? fetchLiveSports(),
  ]);

  const game = findLiveGame(liveGames, queryTokens);
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

    const margin = game.homeScore !== undefined && game.awayScore !== undefined
      ? scoreMargin(game.homeScore, game.awayScore, queryTokens, game.home, game.away)
      : null;

    if (margin !== null && margin >= 15 && isPoly && entryPrice) {
      // Strong in-game lead → contract likely repriced well above entry; nudge check even before price fetch.
      base.reason = `Your pick is up ${margin} — contract may have hit your $${profitGoal} target`;
    }
  }

  if (isPoly && entryPrice) {
    const match = findPolymarketPrice(polyMarkets, queryTokens);
    const currentPrice = match?.price;
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
        reason = `Contract at ${(currentPrice * 100).toFixed(0)}¢ · up $${Math.max(0, unrealizedPnl).toFixed(0)} of $${profitGoal} goal`;
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
    reason: isPoly
      ? 'Waiting for live contract price — pull to refresh'
      : 'No live event found yet — pull to refresh',
  };
}

export async function fetchAllBetStatuses(bets: TrackedBet[]): Promise<BetLiveStatus[]> {
  const active = bets.filter((b) => b.status === 'active');
  if (active.length === 0) return [];

  const needsPoly = active.some(isPredictionMarketBet);
  const [markets, games] = await Promise.all([
    needsPoly ? fetchPolymarketMarkets() : Promise.resolve([]),
    fetchLiveSports(),
  ]);

  return Promise.all(active.map((bet) => fetchBetLiveStatus(bet, markets, games)));
}
