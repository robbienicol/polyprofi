import { buildRouteResults } from '@/lib/route-results/build';
import {
  activeKeyword,
  groupRoutesByChance,
  predictionFacetsActive,
  routeMatchesKeyword,
  searchOutcome,
} from '@/lib/route-results/filters';
import { shouldOfferCapitalSafe } from '@/lib/route-results/relevance';
import type { RouteFilters } from '@/lib/route-results/types';
import type { Route, RouteParams } from '@/types/routes';
import { checkGates } from '@/lib/route-results/check-gates';

// ── self-check ──────────────────────────────────────────────────────────────
export function __selfCheck(): void {
  checkGates();

  const params: RouteParams = {
    balance: 1000,
    target: 100,
    timeframe: 'week',
    categories: [],
    riskTolerance: 'balanced',
    maxRiskLevel: 5,
    minProbability: 0,
  };
  const filters: RouteFilters = {
    category: null,
    lossProfile: null,
    minimumProbability: 0,
    sort: 'score',
    predictionTopic: null,
    maxDaysToResolve: null,
    groupByChance: false,
    keyword: '',
  };
  const reportedRoute: Route = {
    id: 'reported-87c',
    category: 'Polymarket',
    emoji: '🔮',
    description: 'Reported 87¢ contract',
    riskLevel: 2,
    probability: 87,
    expectedReturn: 149,
    platform: 'Polymarket',
    strategy: '',
    line: 'No 87¢',
    maturesInDays: 7,
    lossProfile: 'binary',
    meetsTarget: true,
  };
  const sized = buildRouteResults([reportedRoute], params, 1000, filters);
  const sizedRoute = sized.ranked[0];
  console.assert(
    sized.selectedStake(sizedRoute) === 670 && sizedRoute.expectedReturn === 100,
    '87¢ route uses $670 to make the $100 goal instead of risking the full $1,000',
  );

  const overBudgetRoute: Route = {
    ...reportedRoute,
    id: 'over-budget',
    category: 'Stocks & ETFs',
    probability: 90,
    expectedReturn: 80,
    line: undefined,
    lossProfile: 'partial',
  };
  const capped = buildRouteResults([overBudgetRoute], params, 1000, filters);
  console.assert(
    capped.selectedStake(capped.ranked[0]) === 1000 && capped.ranked[0].expectedReturn === 80,
    'a route never uses more than the amount the user is willing to invest',
  );

  const stocksOnly = buildRouteResults(
    [reportedRoute, overBudgetRoute],
    params,
    1000,
    { ...filters, category: 'Stocks & ETFs' },
  );
  console.assert(
    stocksOnly.filtered.length === 1 && stocksOnly.filtered[0].id === overBudgetRoute.id,
    'asset-class filter keeps only routes in the selected category',
  );

  // ── prediction facets ─────────────────────────────────────────────────────
  const sportsRoute: Route = { ...reportedRoute, id: 'pm-sports', predictionTopic: 'sports' };
  const politicsRoute: Route = { ...reportedRoute, id: 'pm-politics', predictionTopic: 'politics' };
  const untaggedRoute: Route = { ...reportedRoute, id: 'pm-untagged' };
  const pool = [sportsRoute, politicsRoute, untaggedRoute];

  const sportsOnly = buildRouteResults(pool, params, 1000, { ...filters, category: 'Polymarket', predictionTopic: 'sports' });
  console.assert(
    sportsOnly.filtered.length === 1 && sportsOnly.filtered[0].id === 'pm-sports',
    'a topic filter keeps only routes carrying that topic',
  );
  console.assert(
    buildRouteResults(pool, params, 1000, filters).filtered.length === 3,
    'with no topic filter, untagged prediction routes still show',
  );
  // Regression: leaving the prediction asset class hides the facet panel, so its
  // filters must stop applying. Otherwise the list silently narrows with no visible
  // control explaining why.
  const topicSetButPanelHidden = buildRouteResults(pool, params, 1000, {
    ...filters,
    category: null,
    predictionTopic: 'sports',
    maxDaysToResolve: 7,
  });
  console.assert(
    topicSetButPanelHidden.filtered.length === 3,
    'prediction facets do not apply while the panel that sets them is hidden',
  );
  console.assert(
    buildRouteResults(pool, params, 1000, { ...filters, category: 'Polymarket', predictionTopic: 'sports' }).filtered.length === 1,
    'prediction facets do apply once a prediction asset class is selected',
  );
  console.assert(
    !predictionFacetsActive({ ...filters, category: null }) && predictionFacetsActive({ ...filters, category: 'Polymarket' }),
    'facets are live only for prediction asset classes',
  );

  const soon: Route = { ...reportedRoute, id: 'soon', maturesInDays: 3 };
  const later: Route = { ...reportedRoute, id: 'later', maturesInDays: 40 };
  const noDate: Route = { ...reportedRoute, id: 'no-date', maturesInDays: undefined };
  const within7 = buildRouteResults([soon, later, noDate], params, 1000, { ...filters, category: 'Polymarket', maxDaysToResolve: 7 });
  console.assert(
    within7.filtered.length === 1 && within7.filtered[0].id === 'soon',
    'a resolution window keeps only routes maturing inside it, and drops undated ones',
  );

  // ── chance grouping ───────────────────────────────────────────────────────
  const band = (id: string, probability: number): Route => ({ ...reportedRoute, id, probability });
  const groups = groupRoutesByChance([band('a', 92), band('b', 70), band('c', 50), band('d', 12), band('e', 88)]);
  console.assert(
    groups.map((g) => g.floor).join(',') === '85,65,35,0',
    'groups run from most to least likely',
  );
  console.assert(
    groups[0].routes.length === 2 && groups[0].label === 'Very likely',
    'the 85+ band collects every route at or above 85',
  );
  console.assert(
    groups.every((g) => g.routes.length > 0),
    'empty bands are omitted rather than rendered as empty sections',
  );
  console.assert(
    groupRoutesByChance([band('x', 84)])[0].floor === 65,
    '84% sits in the 65-84 band, not the 85+ one',
  );
  console.assert(groupRoutesByChance([]).length === 0, 'no routes means no groups');

  // ── capital-safe nudge ────────────────────────────────────────────────────
  // The situation it exists for: a small budget against a real goal, where the only
  // routes that survive are binary contracts and every capital-preserving one was
  // dropped as unaffordable.
  const smallBudget: RouteParams = { ...params, balance: 500, target: 300 };
  const binaryContract: Route = {
    ...reportedRoute, id: 'pm-cheap', probability: 60, expectedReturn: 300,
    line: 'Yes 62¢', lossProfile: 'binary', meetsTarget: true,
  };
  const pricyTbill: Route = {
    ...reportedRoute, id: 'tbill-pricy', category: 'Savings & Treasuries', platform: 'TreasuryDirect',
    probability: 99, expectedReturn: 20, line: undefined, lossProfile: 'partial', meetsTarget: false,
  };
  const squeezed = buildRouteResults([binaryContract, pricyTbill], smallBudget, 500, filters);
  console.assert(
    squeezed.unlockCapitalSafeInvestment != null && squeezed.unlockCapitalSafeInvestment > 500,
    'a T-bill priced out of the current budget reports the amount that reaches the goal',
  );
  console.assert(
    !squeezed.filtered.some((route) => route.lossProfile === 'partial'),
    'the same T-bill is genuinely absent from the list, which is what the nudge explains',
  );
  console.assert(
    shouldOfferCapitalSafe(filters, squeezed.filtered, squeezed.unlockCapitalSafeInvestment),
    'an all-binary list with a reachable safe route offers the nudge',
  );

  // Already affordable → nothing to unlock, and the safe route is on screen anyway.
  const roomy = buildRouteResults([binaryContract, pricyTbill], smallBudget, 1_000_000, filters);
  console.assert(
    !shouldOfferCapitalSafe(filters, roomy.filtered, roomy.unlockCapitalSafeInvestment),
    'no nudge once the capital-preserving route is affordable',
  );

  // No safe route in the pool at any price → never promise one.
  const binaryOnly = buildRouteResults([binaryContract], smallBudget, 500, filters);
  console.assert(
    binaryOnly.unlockCapitalSafeInvestment === null
      && !shouldOfferCapitalSafe(filters, binaryOnly.filtered, binaryOnly.unlockCapitalSafeInvestment),
    'a pool with no capital-preserving route at any amount offers nothing',
  );

  // The user asked for all-or-nothing, or for one asset class: their choice, not a budget.
  console.assert(
    !shouldOfferCapitalSafe({ ...filters, lossProfile: 'binary' }, squeezed.filtered, 2_400)
      && !shouldOfferCapitalSafe({ ...filters, category: 'Polymarket' }, squeezed.filtered, 2_400),
    'no nudge when the user themselves excluded the safe routes',
  );
  console.assert(
    !shouldOfferCapitalSafe(filters, [pricyTbill], 2_400),
    'a capital-preserving route anywhere in the filtered list silences the nudge',
  );
  console.assert(
    !shouldOfferCapitalSafe({ ...filters, keyword: 'messi' }, squeezed.filtered, 2_400),
    'a named market search is not a budget problem — no nudge while a keyword is set',
  );

  // ── keyword search ────────────────────────────────────────────────────────
  const messi: Route = { ...reportedRoute, id: 'pm-messi', description: 'Buy Yes on “Will Lionel Messi score in the final?” at 41¢', line: 'Yes 41¢' };
  const tesla: Route = { ...reportedRoute, id: 'pm-tesla', description: 'Buy No on “Tesla launches robotaxis in California by Dec 31” at 84¢', line: 'No 84¢' };
  console.assert(routeMatchesKeyword(messi, 'messi'), 'a keyword matches case-insensitively');
  console.assert(routeMatchesKeyword(messi, 'MESSI final'), 'every word must appear, and case is ignored');
  console.assert(!routeMatchesKeyword(messi, 'messi ronaldo'), 'an extra word narrows rather than widens');
  console.assert(!routeMatchesKeyword(tesla, 'messi'), 'an unrelated route does not match');
  console.assert(routeMatchesKeyword(tesla, '  '), 'an all-whitespace keyword matches everything');
  console.assert(routeMatchesKeyword(tesla, '84¢'), 'the line is searchable too');

  const keyworded = buildRouteResults([messi, tesla], params, 1000, { ...filters, category: 'Polymarket', keyword: 'messi' });
  console.assert(
    keyworded.filtered.length === 1 && keyworded.filtered[0].id === 'pm-messi',
    'a keyword narrows the list to matching routes',
  );
  console.assert(
    activeKeyword({ ...filters, keyword: '  messi  ' }) === 'messi',
    'a keyword applies in every asset class, trimmed',
  );
  console.assert(
    buildRouteResults([messi, tesla], params, 1000, { ...filters, keyword: 'messi' }).filtered.length === 1,
    'a keyword narrows the all-assets view too, not just prediction markets',
  );
  const etf: Route = {
    ...reportedRoute,
    id: 'etf-voo',
    category: 'Stocks & ETFs',
    platform: 'Brokerage',
    description: 'Put your $1,000 in VOO (Vanguard S&P 500 ETF, currently $500)',
    line: undefined,
    lossProfile: 'partial',
  };
  console.assert(
    buildRouteResults([etf, messi], params, 1000, { ...filters, keyword: 'voo' }).filtered.length === 1,
    'an asset search matches a fund route, which carries no prediction facets at all',
  );
  console.assert(
    routeMatchesKeyword(etf, 'brokerage') && routeMatchesKeyword(messi, 'polymarket'),
    'category and platform are searchable, since both are printed on the card',
  );

  // ── search outcome ────────────────────────────────────────────────────────
  console.assert(
    searchOutcome({ keyword: '', matchCount: 0, shownCount: 0, isSearching: false }) === 'idle',
    'no keyword means no search message at all',
  );
  console.assert(
    searchOutcome({ keyword: 'messi', matchCount: 0, shownCount: 0, isSearching: true }) === 'searching',
    'a search still in flight is not yet a miss',
  );
  console.assert(
    searchOutcome({ keyword: 'doge', matchCount: 0, shownCount: 0, isSearching: false }) === 'uncovered',
    'nothing found anywhere means we do not cover it — say so rather than showing an empty list',
  );
  console.assert(
    searchOutcome({ keyword: 'doge', matchCount: 3, shownCount: 0, isSearching: false }) === 'filtered-out',
    'found but hidden is a filter problem, not a coverage one',
  );
  console.assert(
    searchOutcome({ keyword: 'doge', matchCount: 3, shownCount: 3, isSearching: false }) === 'found',
    'found and shown needs no explanation',
  );

  // A named market that cannot reach the goal must still show: the user asked for it.
  // The stake-rescorer derives the return from the contract price in `line`, not from
  // expectedReturn, so "hopeless" has to be a genuinely expensive contract: 97¢ pays
  // about +$31 on $1,000, well under the $100 goal and under the near-miss floor.
  const hopeless: Route = {
    ...reportedRoute,
    id: 'pm-hopeless',
    description: 'Buy Yes on “Messi plays in the next match” at 97¢',
    line: 'Yes 97¢',
    probability: 97,
    meetsTarget: false,
  };
  const namedButShort = buildRouteResults([hopeless], params, 1000, { ...filters, category: 'Polymarket', keyword: 'messi' });
  console.assert(
    namedButShort.filtered.some((route) => route.id === 'pm-hopeless'),
    'a searched market that misses the goal is still shown rather than filtered away',
  );
  console.assert(
    buildRouteResults([hopeless], params, 1000, { ...filters, category: 'Polymarket' }).filtered.length === 0,
    'without a keyword the same hopeless route is still dropped as irrelevant',
  );
  console.assert(
    groupRoutesByChance([band('a', 92), band('b', 70)]).reduce((n, g) => n + g.routes.length, 0) === 2,
    'grouping partitions the routes without dropping or duplicating any',
  );
}
