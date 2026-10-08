import type { KalshiEntry } from '@/api/client/market-data-types';

// Heuristic team+date matching between a Polymarket sports market and
// Kalshi's per-game moneyline markets. This is best-effort, not guaranteed
// correct — it is intentionally biased toward returning no match rather than
// a wrong one, since a wrong cross-platform "value" comparison is worse than
// none. Known gaps: unrecognized team spellings, doubleheaders (two games
// same teams same day), and team-alias maintenance as rosters/relocations
// change over time.
//
// Polymarket's two `outcomes` strings are full "City Nickname" names (e.g.
// "Los Angeles Lakers", confirmed against the live Gamma API), so team
// identification on that side uses a STRICT full-name match — this is what
// keeps things like "Los Angeles Lakers" vs "Boston Celtics" from also
// spuriously qualifying as an NHL match on the bare city names "Los Angeles"
// and "Boston" (LA Kings / Boston Bruins). Kalshi's yes_sub_title, by
// contrast, is often just a city or partial name (e.g. "Detroit") — but by
// the time we're resolving it we already know the league from the series
// ticker, so a looser match (full name, city, or nickname) is safe there.

export type League = 'NBA' | 'WNBA' | 'NFL' | 'MLB' | 'NHL';

export const KALSHI_SERIES_LEAGUE: Record<string, League> = {
  KXNBAGAME: 'NBA',
  KXWNBAGAME: 'WNBA',
  KXNFLGAME: 'NFL',
  KXMLBGAME: 'MLB',
  KXNHLGAME: 'NHL',
};

export interface SportsMatch {
  polymarketSlug: string;
  league: League;
  // Kalshi ticker whose "Yes" side corresponds to the same team as the
  // Polymarket market's "Yes" outcome (team A in "will A beat B").
  kalshiYesTicker: string;
  // Kalshi ticker whose "Yes" side corresponds to Polymarket's "No" outcome (team B).
  kalshiNoTicker: string;
}

interface TeamAliasEntry {
  key: string;
  full: string;
  city: string;
  nickname: string;
}

function team(league: string, code: string, city: string, nickname: string): TeamAliasEntry {
  return {
    key: `${league}:${code}`,
    full: `${city} ${nickname}`.toLowerCase(),
    city: city.toLowerCase(),
    nickname: nickname.toLowerCase(),
  };
}

const TEAM_ALIASES: Record<League, TeamAliasEntry[]> = {
  NBA: [
    team('NBA', 'ATL', 'Atlanta', 'Hawks'), team('NBA', 'BOS', 'Boston', 'Celtics'),
    team('NBA', 'BKN', 'Brooklyn', 'Nets'), team('NBA', 'CHA', 'Charlotte', 'Hornets'),
    team('NBA', 'CHI', 'Chicago', 'Bulls'), team('NBA', 'CLE', 'Cleveland', 'Cavaliers'),
    team('NBA', 'DAL', 'Dallas', 'Mavericks'), team('NBA', 'DEN', 'Denver', 'Nuggets'),
    team('NBA', 'DET', 'Detroit', 'Pistons'), team('NBA', 'GSW', 'Golden State', 'Warriors'),
    team('NBA', 'HOU', 'Houston', 'Rockets'), team('NBA', 'IND', 'Indiana', 'Pacers'),
    team('NBA', 'LAC', 'LA', 'Clippers'), team('NBA', 'LAL', 'Los Angeles', 'Lakers'),
    team('NBA', 'MEM', 'Memphis', 'Grizzlies'), team('NBA', 'MIA', 'Miami', 'Heat'),
    team('NBA', 'MIL', 'Milwaukee', 'Bucks'), team('NBA', 'MIN', 'Minnesota', 'Timberwolves'),
    team('NBA', 'NOP', 'New Orleans', 'Pelicans'), team('NBA', 'NYK', 'New York', 'Knicks'),
    team('NBA', 'OKC', 'Oklahoma City', 'Thunder'), team('NBA', 'ORL', 'Orlando', 'Magic'),
    team('NBA', 'PHI', 'Philadelphia', '76ers'), team('NBA', 'PHX', 'Phoenix', 'Suns'),
    team('NBA', 'POR', 'Portland', 'Trail Blazers'), team('NBA', 'SAC', 'Sacramento', 'Kings'),
    team('NBA', 'SAS', 'San Antonio', 'Spurs'), team('NBA', 'TOR', 'Toronto', 'Raptors'),
    team('NBA', 'UTA', 'Utah', 'Jazz'), team('NBA', 'WAS', 'Washington', 'Wizards'),
  ],
  WNBA: [
    team('WNBA', 'ATL', 'Atlanta', 'Dream'), team('WNBA', 'CHI', 'Chicago', 'Sky'),
    team('WNBA', 'CON', 'Connecticut', 'Sun'), team('WNBA', 'DAL', 'Dallas', 'Wings'),
    team('WNBA', 'GSV', 'Golden State', 'Valkyries'), team('WNBA', 'IND', 'Indiana', 'Fever'),
    team('WNBA', 'LVA', 'Las Vegas', 'Aces'), team('WNBA', 'LAS', 'Los Angeles', 'Sparks'),
    team('WNBA', 'MIN', 'Minnesota', 'Lynx'), team('WNBA', 'NYL', 'New York', 'Liberty'),
    team('WNBA', 'PHX', 'Phoenix', 'Mercury'), team('WNBA', 'POR', 'Portland', 'Fire'),
    team('WNBA', 'SEA', 'Seattle', 'Storm'), team('WNBA', 'TOR', 'Toronto', 'Tempo'),
    team('WNBA', 'WAS', 'Washington', 'Mystics'),
  ],
  NFL: [
    team('NFL', 'ARI', 'Arizona', 'Cardinals'), team('NFL', 'ATL', 'Atlanta', 'Falcons'),
    team('NFL', 'BAL', 'Baltimore', 'Ravens'), team('NFL', 'BUF', 'Buffalo', 'Bills'),
    team('NFL', 'CAR', 'Carolina', 'Panthers'), team('NFL', 'CHI', 'Chicago', 'Bears'),
    team('NFL', 'CIN', 'Cincinnati', 'Bengals'), team('NFL', 'CLE', 'Cleveland', 'Browns'),
    team('NFL', 'DAL', 'Dallas', 'Cowboys'), team('NFL', 'DEN', 'Denver', 'Broncos'),
    team('NFL', 'DET', 'Detroit', 'Lions'), team('NFL', 'GB', 'Green Bay', 'Packers'),
    team('NFL', 'HOU', 'Houston', 'Texans'), team('NFL', 'IND', 'Indianapolis', 'Colts'),
    team('NFL', 'JAX', 'Jacksonville', 'Jaguars'), team('NFL', 'KC', 'Kansas City', 'Chiefs'),
    team('NFL', 'LV', 'Las Vegas', 'Raiders'), team('NFL', 'LAC', 'Los Angeles', 'Chargers'),
    team('NFL', 'LAR', 'Los Angeles', 'Rams'), team('NFL', 'MIA', 'Miami', 'Dolphins'),
    team('NFL', 'MIN', 'Minnesota', 'Vikings'), team('NFL', 'NE', 'New England', 'Patriots'),
    team('NFL', 'NO', 'New Orleans', 'Saints'), team('NFL', 'NYG', 'New York', 'Giants'),
    team('NFL', 'NYJ', 'New York', 'Jets'), team('NFL', 'PHI', 'Philadelphia', 'Eagles'),
    team('NFL', 'PIT', 'Pittsburgh', 'Steelers'), team('NFL', 'SF', 'San Francisco', '49ers'),
    team('NFL', 'SEA', 'Seattle', 'Seahawks'), team('NFL', 'TB', 'Tampa Bay', 'Buccaneers'),
    team('NFL', 'TEN', 'Tennessee', 'Titans'), team('NFL', 'WAS', 'Washington', 'Commanders'),
  ],
  MLB: [
    team('MLB', 'ARI', 'Arizona', 'Diamondbacks'), team('MLB', 'ATL', 'Atlanta', 'Braves'),
    team('MLB', 'BAL', 'Baltimore', 'Orioles'), team('MLB', 'BOS', 'Boston', 'Red Sox'),
    team('MLB', 'CHC', 'Chicago', 'Cubs'), team('MLB', 'CWS', 'Chicago', 'White Sox'),
    team('MLB', 'CIN', 'Cincinnati', 'Reds'), team('MLB', 'CLE', 'Cleveland', 'Guardians'),
    team('MLB', 'COL', 'Colorado', 'Rockies'), team('MLB', 'DET', 'Detroit', 'Tigers'),
    team('MLB', 'HOU', 'Houston', 'Astros'), team('MLB', 'KC', 'Kansas City', 'Royals'),
    team('MLB', 'LAA', 'Los Angeles', 'Angels'), team('MLB', 'LAD', 'Los Angeles', 'Dodgers'),
    team('MLB', 'MIA', 'Miami', 'Marlins'), team('MLB', 'MIL', 'Milwaukee', 'Brewers'),
    team('MLB', 'MIN', 'Minnesota', 'Twins'), team('MLB', 'NYM', 'New York', 'Mets'),
    team('MLB', 'NYY', 'New York', 'Yankees'), team('MLB', 'ATH', 'Athletics', 'Athletics'),
    team('MLB', 'PHI', 'Philadelphia', 'Phillies'), team('MLB', 'PIT', 'Pittsburgh', 'Pirates'),
    team('MLB', 'SD', 'San Diego', 'Padres'), team('MLB', 'SF', 'San Francisco', 'Giants'),
    team('MLB', 'SEA', 'Seattle', 'Mariners'), team('MLB', 'STL', 'St. Louis', 'Cardinals'),
    team('MLB', 'TB', 'Tampa Bay', 'Rays'), team('MLB', 'TEX', 'Texas', 'Rangers'),
    team('MLB', 'TOR', 'Toronto', 'Blue Jays'), team('MLB', 'WSH', 'Washington', 'Nationals'),
  ],
  NHL: [
    team('NHL', 'ANA', 'Anaheim', 'Ducks'), team('NHL', 'BOS', 'Boston', 'Bruins'),
    team('NHL', 'BUF', 'Buffalo', 'Sabres'), team('NHL', 'CGY', 'Calgary', 'Flames'),
    team('NHL', 'CAR', 'Carolina', 'Hurricanes'), team('NHL', 'CHI', 'Chicago', 'Blackhawks'),
    team('NHL', 'COL', 'Colorado', 'Avalanche'), team('NHL', 'CBJ', 'Columbus', 'Blue Jackets'),
    team('NHL', 'DAL', 'Dallas', 'Stars'), team('NHL', 'DET', 'Detroit', 'Red Wings'),
    team('NHL', 'EDM', 'Edmonton', 'Oilers'), team('NHL', 'FLA', 'Florida', 'Panthers'),
    team('NHL', 'LAK', 'Los Angeles', 'Kings'), team('NHL', 'MIN', 'Minnesota', 'Wild'),
    team('NHL', 'MTL', 'Montreal', 'Canadiens'), team('NHL', 'NSH', 'Nashville', 'Predators'),
    team('NHL', 'NJD', 'New Jersey', 'Devils'), team('NHL', 'NYI', 'New York', 'Islanders'),
    team('NHL', 'NYR', 'New York', 'Rangers'), team('NHL', 'OTT', 'Ottawa', 'Senators'),
    team('NHL', 'PHI', 'Philadelphia', 'Flyers'), team('NHL', 'PIT', 'Pittsburgh', 'Penguins'),
    team('NHL', 'SJS', 'San Jose', 'Sharks'), team('NHL', 'SEA', 'Seattle', 'Kraken'),
    team('NHL', 'STL', 'St. Louis', 'Blues'), team('NHL', 'TBL', 'Tampa Bay', 'Lightning'),
    team('NHL', 'TOR', 'Toronto', 'Maple Leafs'), team('NHL', 'UTA', 'Utah', 'Mammoth'),
    team('NHL', 'VAN', 'Vancouver', 'Canucks'), team('NHL', 'VGK', 'Vegas', 'Golden Knights'),
    team('NHL', 'WSH', 'Washington', 'Capitals'), team('NHL', 'WPG', 'Winnipeg', 'Jets'),
  ],
};

const LEAGUES = Object.keys(TEAM_ALIASES) as League[];

// Loose match against any of a team's aliases (full name, city, or nickname).
// Safe to use once the league is already known/fixed (e.g. Kalshi's
// yes_sub_title, resolved within the league its series ticker already told us).
function resolveTeamInLeague(rawFragment: string, league: League): string | null {
  const text = rawFragment.toLowerCase().trim();
  if (!text) return null;
  let best: { key: string; aliasLength: number } | null = null;
  for (const entry of TEAM_ALIASES[league]) {
    for (const alias of [entry.full, entry.city, entry.nickname]) {
      if (text === alias || text.includes(alias) || alias.includes(text)) {
        if (!best || alias.length > best.aliasLength) best = { key: entry.key, aliasLength: alias.length };
      }
    }
  }
  return best?.key ?? null;
}

// Strict full-"City Nickname"-only match, used to determine the league itself
// from Polymarket's outcome text — bare city/nickname aliases are deliberately
// excluded here since they cause false cross-league hits (e.g. "Los Angeles"
// alone matches both the Lakers and the Kings).
function resolveTeamByFullName(rawFragment: string, league: League): string | null {
  const text = rawFragment.toLowerCase().trim();
  if (!text) return null;
  for (const entry of TEAM_ALIASES[league]) {
    if (text === entry.full || text.includes(entry.full) || entry.full.includes(text)) return entry.key;
  }
  return null;
}

function findQualifyingLeagues(
  rawA: string,
  rawB: string,
): { league: League; teamAKey: string; teamBKey: string }[] {
  const results: { league: League; teamAKey: string; teamBKey: string }[] = [];
  for (const league of LEAGUES) {
    const teamAKey = resolveTeamByFullName(rawA, league);
    const teamBKey = resolveTeamByFullName(rawB, league);
    if (teamAKey && teamBKey && teamAKey !== teamBKey) results.push({ league, teamAKey, teamBKey });
  }
  return results;
}

// Polymarket sports moneylines resolve with the actual team names as the two
// outcomes (e.g. outcomes: ["Toronto Tempo", "Minnesota Lynx"]), not literal
// "Yes"/"No" — confirmed against the live Gamma API. So team identification
// works directly off `outcomes`, not by parsing the question text (which
// varies a lot: "A vs. B", "Will A win on <date>?", etc., and often doesn't
// name both teams at all).
function identifyMoneylineTeams(
  outcomes: string[],
): { league: League; teamAKey: string; teamBKey: string } | null {
  if (outcomes.length !== 2) return null;
  const qualifying = findQualifyingLeagues(outcomes[0], outcomes[1]);
  return qualifying.length === 1 ? qualifying[0] : null;
}

function closeEnough(aIso: string | undefined, bIso: string | undefined): boolean {
  if (!aIso || !bIso) return false;
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= 86_400_000; // ±1 day
}

// Polymarket spread/total/handicap markets use the SAME two team names as
// outcomes as a plain moneyline does (e.g. "Spread: Los Angeles Dodgers
// (-1.5)" still has outcomes ["Los Angeles Dodgers", "Seattle Mariners"]),
// so outcomes alone can't tell a moneyline apart from a spread — confirmed
// live, this produced false matches against Kalshi's moneyline price before
// this guard was added. Kalshi only offers moneylines here, so anything
// else must be excluded by its question text.
const NON_MONEYLINE_PREFIX = /^(spread|total|game handicap|map handicap):/i;
const OVER_UNDER_SUFFIX = /:\s*o\/u\b/i;

function isMoneylineQuestion(question: string): boolean {
  return !NON_MONEYLINE_PREFIX.test(question) && !OVER_UNDER_SUFFIX.test(question);
}

/**
 * Matches a Polymarket sports market against Kalshi's per-game moneyline
 * markets. Returns null (no card) unless there's exactly one unambiguous
 * Kalshi game with the same two teams and a game time within a day of the
 * Polymarket end date — anything less certain (ambiguous league, partial
 * team match, no date overlap, a spread/total market, or more than one
 * candidate game e.g. a doubleheader) is treated as no match rather than a guess.
 */
export function matchPolymarketToKalshi(
  polymarket: { slug?: string; question: string; outcomes: string[]; endDate?: string },
  kalshiEntries: KalshiEntry[],
): SportsMatch | null {
  if (!polymarket.slug || !isMoneylineQuestion(polymarket.question)) return null;
  const identified = identifyMoneylineTeams(polymarket.outcomes);
  if (!identified) return null;
  const { league, teamAKey, teamBKey } = identified;

  const byEvent = new Map<string, KalshiEntry[]>();
  for (const entry of kalshiEntries) {
    if (KALSHI_SERIES_LEAGUE[entry.seriesTicker] !== league) continue;
    const group = byEvent.get(entry.eventTicker) ?? [];
    group.push(entry);
    byEvent.set(entry.eventTicker, group);
  }

  const candidates: { yesTicker: string; noTicker: string }[] = [];
  for (const group of byEvent.values()) {
    if (group.length !== 2) continue; // exactly 2 markets expected per moneyline event
    const [m1, m2] = group;
    const t1 = m1.yesSubTitle ? resolveTeamInLeague(m1.yesSubTitle, league) : null;
    const t2 = m2.yesSubTitle ? resolveTeamInLeague(m2.yesSubTitle, league) : null;
    if (!t1 || !t2 || t1 === t2) continue;
    const teamSet = new Set([t1, t2]);
    if (!teamSet.has(teamAKey) || !teamSet.has(teamBKey)) continue;
    if (!closeEnough(polymarket.endDate, m1.expectedExpirationTime ?? m2.expectedExpirationTime)) continue;
    candidates.push(
      t1 === teamAKey
        ? { yesTicker: m1.ticker, noTicker: m2.ticker }
        : { yesTicker: m2.ticker, noTicker: m1.ticker },
    );
  }

  if (candidates.length !== 1) return null; // 0 = no match, >1 = ambiguous (e.g. doubleheader)
  return { polymarketSlug: polymarket.slug, league, kalshiYesTicker: candidates[0].yesTicker, kalshiNoTicker: candidates[0].noTicker };
}

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
