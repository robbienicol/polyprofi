import type { KalshiEntry } from '@/api/client/market-data-types';
import { findQualifyingLeagues, matchPolymarketToKalshi, resolveTeamByFullName, resolveTeamInLeague } from '@/lib/sports-market-match';

export function __selfCheck(): void {
  console.assert(
    resolveTeamInLeague('kings', 'NBA') === 'NBA:SAC',
    'a bare nickname should resolve within an already-known league (Kalshi-side lookup)',
  );
  console.assert(
    resolveTeamInLeague('los angeles', 'NHL') === 'NHL:LAK',
    'a bare city should resolve within an already-known league (Kalshi-side lookup)',
  );
  console.assert(
    resolveTeamByFullName('los angeles lakers', 'NBA') === 'NBA:LAL',
    'a full team name should resolve strictly within its league',
  );
  console.assert(
    resolveTeamByFullName('los angeles lakers', 'NHL') === null,
    'a bare-city collision (LA Kings) must not resolve under strict full-name matching',
  );

  // Bare city names overlap across leagues ("Los Angeles" fields Lakers/Clippers/
  // Kings/Dodgers/Rams...), which is exactly why Polymarket-side league
  // identification requires the strict full-name match — "Los Angeles Lakers"
  // vs "Boston Celtics" must resolve to NBA only, not also spuriously match NHL
  // via "Los Angeles" (Kings) / "Boston" (Bruins).
  const qualifying = findQualifyingLeagues('Los Angeles Lakers', 'Boston Celtics');
  console.assert(
    qualifying.length === 1 && qualifying[0].league === 'NBA',
    'full "City Nickname" outcomes must resolve to exactly one league, even when bare city names collide elsewhere',
  );

  const kalshiEvent = (eventTicker: string, teamA: string, tickerA: string, teamB: string, tickerB: string, gameTime: string): KalshiEntry[] => [
    { ticker: tickerA, eventTicker, seriesTicker: 'KXNBAGAME', title: `${teamA} vs ${teamB} Winner?`, yesSubTitle: teamA, status: 'open', expectedExpirationTime: gameTime },
    { ticker: tickerB, eventTicker, seriesTicker: 'KXNBAGAME', title: `${teamA} vs ${teamB} Winner?`, yesSubTitle: teamB, status: 'open', expectedExpirationTime: gameTime },
  ];

  const lakersVsCeltics = ['Los Angeles Lakers', 'Boston Celtics'];
  const moneylineQuestion = 'Los Angeles Lakers vs. Boston Celtics';

  const goodMatch = matchPolymarketToKalshi(
    { slug: 'lakers-beat-celtics', question: moneylineQuestion, outcomes: lakersVsCeltics, endDate: '2026-07-30T23:00:00Z' },
    kalshiEvent('KXNBAGAME-26JUL30LALBOS', 'Los Angeles', 'KXNBAGAME-26JUL30LALBOS-LAL', 'Boston', 'KXNBAGAME-26JUL30LALBOS-BOS', '2026-07-30T23:10:00Z'),
  );
  console.assert(
    goodMatch?.kalshiYesTicker === 'KXNBAGAME-26JUL30LALBOS-LAL' && goodMatch?.kalshiNoTicker === 'KXNBAGAME-26JUL30LALBOS-BOS',
    'a clean same-teams, same-day match should resolve with correct outcome direction',
  );

  const dateMismatch = matchPolymarketToKalshi(
    { slug: 'lakers-beat-celtics-later', question: moneylineQuestion, outcomes: lakersVsCeltics, endDate: '2026-08-15T23:00:00Z' },
    kalshiEvent('KXNBAGAME-26JUL30LALBOS', 'Los Angeles', 'KXNBAGAME-26JUL30LALBOS-LAL', 'Boston', 'KXNBAGAME-26JUL30LALBOS-BOS', '2026-07-30T23:10:00Z'),
  );
  console.assert(dateMismatch === null, 'a date far outside the window must not match');

  const doubleheader = matchPolymarketToKalshi(
    { slug: 'lakers-beat-celtics-dh', question: moneylineQuestion, outcomes: lakersVsCeltics, endDate: '2026-07-30T23:00:00Z' },
    [
      ...kalshiEvent('KXNBAGAME-26JUL30LALBOS-G1', 'Los Angeles', 'KXNBAGAME-26JUL30LALBOS-G1-LAL', 'Boston', 'KXNBAGAME-26JUL30LALBOS-G1-BOS', '2026-07-30T20:00:00Z'),
      ...kalshiEvent('KXNBAGAME-26JUL30LALBOS-G2', 'Los Angeles', 'KXNBAGAME-26JUL30LALBOS-G2-LAL', 'Boston', 'KXNBAGAME-26JUL30LALBOS-G2-BOS', '2026-07-30T23:30:00Z'),
    ],
  );
  console.assert(doubleheader === null, 'two candidate games on the same day must not guess — no match');

  const notASportsMarket = matchPolymarketToKalshi(
    { slug: 'fed-rate-decision', question: 'Will the Fed raise rates?', outcomes: ['Yes', 'No'], endDate: '2026-07-30T23:00:00Z' },
    kalshiEvent('KXNBAGAME-26JUL30LALBOS', 'Los Angeles', 'KXNBAGAME-26JUL30LALBOS-LAL', 'Boston', 'KXNBAGAME-26JUL30LALBOS-BOS', '2026-07-30T23:10:00Z'),
  );
  console.assert(notASportsMarket === null, 'a literal Yes/No market (not team-named outcomes) must not match');

  // Confirmed live: a real Polymarket spread market ("Spread: Los Angeles
  // Dodgers (-1.5)") has the exact same two team-named outcomes as its
  // moneyline sibling, so it would otherwise produce a false match.
  const spreadMarket = matchPolymarketToKalshi(
    { slug: 'lakers-celtics-spread', question: 'Spread: Los Angeles Lakers (-5.5)', outcomes: lakersVsCeltics, endDate: '2026-07-30T23:00:00Z' },
    kalshiEvent('KXNBAGAME-26JUL30LALBOS', 'Los Angeles', 'KXNBAGAME-26JUL30LALBOS-LAL', 'Boston', 'KXNBAGAME-26JUL30LALBOS-BOS', '2026-07-30T23:10:00Z'),
  );
  console.assert(spreadMarket === null, 'a spread market must not match, even with identical team-named outcomes');

  const overUnderMarket = matchPolymarketToKalshi(
    { slug: 'lakers-celtics-total', question: 'Los Angeles Lakers vs. Boston Celtics: O/U 220.5', outcomes: lakersVsCeltics, endDate: '2026-07-30T23:00:00Z' },
    kalshiEvent('KXNBAGAME-26JUL30LALBOS', 'Los Angeles', 'KXNBAGAME-26JUL30LALBOS-LAL', 'Boston', 'KXNBAGAME-26JUL30LALBOS-BOS', '2026-07-30T23:10:00Z'),
  );
  console.assert(overUnderMarket === null, 'an over/under market must not match, even with identical team-named outcomes');

  const noSlug = matchPolymarketToKalshi(
    { question: moneylineQuestion, outcomes: lakersVsCeltics, endDate: '2026-07-30T23:00:00Z' },
    kalshiEvent('KXNBAGAME-26JUL30LALBOS', 'Los Angeles', 'KXNBAGAME-26JUL30LALBOS-LAL', 'Boston', 'KXNBAGAME-26JUL30LALBOS-BOS', '2026-07-30T23:10:00Z'),
  );
  console.assert(noSlug === null, 'a route with no source slug (e.g. AI-generated) can never be matched');
}
