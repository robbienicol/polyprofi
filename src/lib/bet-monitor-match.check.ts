import type { PolymarketEntry, SportsGame } from '@/api/client/market-data-types';
import type { TrackedBet } from '@/types/bets';
import { quotedQuestion, betOutcomeSide, resolveOutcomePrice, findMarketForBet, matchSportsGame, resolvedPolymarketOutcome, resolvedSportsOutcome, sportsScoreMargin, effectiveEntryPrice, positionTargetProfit, monitoredProfitGoal } from '@/lib/bet-monitor-match';

export function __selfCheck(): void {
  const electionBet: TrackedBet = {
    id: 'pm-live-renan-santos-2026-no',
    category: 'Polymarket',
    emoji: '🔮',
    description:
      'Buy No on “Will Renan Santos win the 2026 Brazilian presidential election?” at 92¢ — 92% market-implied chance, $1.2M traded.',
    platform: 'Polymarket',
    strategy: '',
    riskLevel: 2,
    probability: 92,
    expectedReturn: 87,
    amountWagered: 1000,
    status: 'active',
    createdAt: '2026-08-01T00:00:00Z',
    profitGoal: 100,
    entryPrice: 0.92,
    line: 'No 92¢',
    sourceSlug: 'will-renan-santos-win-the-2026-brazilian-presidential-election',
    outcomeSide: 'No',
  };

  const orioles: SportsGame = {
    sport: 'MLB', home: 'Minnesota Twins', away: 'Baltimore Orioles',
    date: '', status: 'Scheduled', homeScore: 0, awayScore: 0,
  };

  // The reported bug: "win" is a substring of "Twins", so any-token substring
  // matching attached an MLB scoreboard to a Brazilian election market.
  console.assert(
    matchSportsGame(electionBet, [orioles]) === null,
    'a non-sports market must not match a game on a substring like "win" in "Twins"',
  );

  const lakersBet: TrackedBet = {
    ...electionBet,
    id: 'pm-live-lakers-celtics-lal',
    description: 'Buy Los Angeles Lakers on “Lakers vs. Celtics” at 62¢ — 62% market-implied chance, $3.0M traded.',
    line: 'Los Angeles Lakers 62¢',
    outcomeSide: 'Los Angeles Lakers',
    sourceSlug: 'lakers-vs-celtics',
    entryPrice: 0.62,
  };
  const lakersGame: SportsGame = {
    sport: 'NBA', home: 'Boston Celtics', away: 'Los Angeles Lakers',
    date: '', status: 'In Progress', homeScore: 88, awayScore: 104,
  };
  console.assert(
    matchSportsGame(lakersBet, [lakersGame, orioles]) === lakersGame,
    'a real sports bet still matches the game that names both of its teams',
  );
  console.assert(
    sportsScoreMargin(lakersGame, betOutcomeSide(lakersBet)) === 16,
    'the margin is measured for the team the user actually bought',
  );
  console.assert(
    sportsScoreMargin(orioles, 'No') === null,
    'a side that names neither team yields no margin instead of a guess',
  );

  // Only one team named → coincidence, not a match.
  console.assert(
    matchSportsGame(
      { description: 'Buy Yes on “Will the Lakers make the playoffs?”', line: 'Yes 40¢', monitorQuery: undefined },
      [lakersGame],
    ) === null,
    'a season-long market naming one team must not bind to that team\'s game tonight',
  );

  console.assert(
    betOutcomeSide(electionBet) === 'No' && betOutcomeSide({ line: 'No 92¢' }) === 'No',
    'the bought side comes from the stored field, and from the line for older positions',
  );
  console.assert(
    betOutcomeSide({ description: 'Buy Los Angeles Lakers on “Lakers vs. Celtics” at 62¢' }) === 'Los Angeles Lakers',
    'the bought side falls back to the description for positions with no line',
  );
  console.assert(
    quotedQuestion(electionBet.description) === 'Will Renan Santos win the 2026 Brazilian presidential election?',
    'the market question is recoverable from the route description',
  );

  const electionMarket: PolymarketEntry = {
    question: 'Will Renan Santos win the 2026 Brazilian presidential election?',
    outcomes: ['Yes', 'No'],
    prices: [0.08, 0.92],
    volumeM: 1.2,
    slug: 'will-renan-santos-win-the-2026-brazilian-presidential-election',
  };
  const unrelated: PolymarketEntry = {
    question: 'Will Bitcoin reach $200k in 2026?',
    outcomes: ['Yes', 'No'],
    prices: [0.22, 0.78],
    volumeM: 9,
    slug: 'will-bitcoin-reach-200k-in-2026',
  };

  console.assert(
    findMarketForBet(electionBet, [unrelated, electionMarket]) === electionMarket,
    'the market is resolved by stored slug, not by shared generic words',
  );
  console.assert(
    findMarketForBet({ description: electionBet.description }, [unrelated, electionMarket]) === electionMarket,
    'a position with no stored slug still resolves by exact question text',
  );
  console.assert(
    findMarketForBet({ description: 'Buy No on “Some market that is no longer listed?” at 40¢' }, [unrelated]) === null,
    'an unlisted market yields no match rather than the nearest unrelated one',
  );

  // The −$756: 0.22 was the *Yes* price of a market this bet is not even on.
  console.assert(
    resolveOutcomePrice(electionMarket, 'No') === 0.92,
    'a No position is priced off the No column, so a flat position reads flat',
  );
  console.assert(
    resolveOutcomePrice(electionMarket, 'Yes') === 0.08,
    'a Yes position is priced off the Yes column',
  );
  console.assert(
    resolveOutcomePrice(electionMarket, 'Los Angeles Lakers') === null,
    'an outcome the market does not offer yields no price',
  );

  console.assert(
    effectiveEntryPrice({ entryPrice: undefined, line: 'No 92¢', probability: 92 }) === 0.92,
    'entry price parses from the line when it was not stored',
  );

  // $1,000 at 92¢ buys 1,087 shares → +$87 at resolution, so a $100 goal is unreachable.
  console.assert(
    positionTargetProfit(electionBet, 0.92) === 87 && monitoredProfitGoal(electionBet, 0.92) === 87,
    'the monitored goal is capped at what the position can actually pay',
  );
  console.assert(
    monitoredProfitGoal({ ...electionBet, amountWagered: 500 }, 0.92) === 43,
    'the cap follows the amount actually staked, not the quiz balance',
  );
  console.assert(
    monitoredProfitGoal({ ...electionBet, profitGoal: 20 }, 0.92) === 20,
    'a reachable goal is left alone',
  );
  console.assert(
    monitoredProfitGoal({ ...electionBet, category: 'Stocks & ETFs', platform: 'Robinhood' }, null) === 100,
    'non-prediction positions keep their requested goal — there is no contract ceiling',
  );

  // ── auto-resolution ───────────────────────────────────────────────────────
  console.assert(
    resolvedPolymarketOutcome({ ...electionMarket, prices: [0.01, 0.99], closed: true }, 'No') === 'won',
    'a No position is won once the market closes with No settled at 99¢+',
  );
  console.assert(
    resolvedPolymarketOutcome({ ...electionMarket, prices: [0.99, 0.01], closed: true }, 'No') === 'lost',
    'a No position is lost once the market closes with No settled at 1¢ or less',
  );
  console.assert(
    resolvedPolymarketOutcome({ ...electionMarket, prices: [0.08, 0.92], closed: true }, 'No') === null,
    'a merely lopsided price (92¢, not 99¢+) is not treated as settled',
  );
  console.assert(
    resolvedPolymarketOutcome({ ...electionMarket, prices: [0.01, 0.99], closed: false }, 'No') === null,
    'a market that has not actually closed is never auto-resolved, however extreme the price',
  );

  const finalGame: SportsGame = { ...lakersGame, status: 'Final', state: 'post', homeScore: 100, awayScore: 104 };
  console.assert(
    resolvedSportsOutcome(finalGame, betOutcomeSide(lakersBet)) === 'won',
    'the Lakers bet resolves won once the final score has them ahead',
  );
  console.assert(
    resolvedSportsOutcome({ ...finalGame, homeScore: 110 }, betOutcomeSide(lakersBet)) === 'lost',
    'the same bet resolves lost once the final score has them behind',
  );
  console.assert(
    resolvedSportsOutcome(lakersGame, betOutcomeSide(lakersBet)) === null,
    'a game still in progress is never auto-resolved, however large the lead',
  );
  console.assert(
    resolvedSportsOutcome({ ...finalGame, homeScore: 100, awayScore: 100 }, betOutcomeSide(lakersBet)) === null,
    'a tied final score is left for the user to call, not guessed at',
  );
}
