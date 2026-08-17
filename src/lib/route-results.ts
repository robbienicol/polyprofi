import { timeframeCalendarDays } from '@/api/client/playbook';
import { isPredictionCategory } from '@/lib/prediction-topics';
import { goalEffectivenessScore, sortByPatheyScore } from '@/lib/score';
import type { GoalScoreBreakdown, GoalScoreContext } from '@/lib/score';
import { rescoreForStake, stakeNeededForReturn } from '@/lib/stake-rescore';
import type { Route, RouteParams } from '@/types/routes';

export type RouteSort = 'score' | 'safest' | 'chance' | 'payout' | 'soonest' | 'type';

export interface RouteFilters {
  category: string | null;
  lossProfile: Route['lossProfile'] | null;
  minimumProbability: number;
  sort: RouteSort;
  /**
   * Prediction-market topic ('sports', 'politics', ...). Only meaningful while the
   * prediction asset class is selected, since no other route carries a topic.
   */
  predictionTopic: string | null;
  /** Longest acceptable time to resolution, in days. Null means any. */
  maxDaysToResolve: number | null;
  /** Sections the list by probability band instead of showing one flat ranking. */
  groupByChance: boolean;
  /**
   * Free-text market search ("Messi", "Tesla"). Matches on what the user can read
   * on the card, and while it is set the near-miss relevance rule stands down —
   * asking for a market by name should show it even when it misses the goal.
   */
  keyword: string;
}

export interface RouteResults {
  ranked: Route[];
  filtered: Route[];
  requiredInvestmentById: Map<string, number | null>;
  scoreById: Map<string, GoalScoreBreakdown>;
  selectedStake: (route: Route) => number;
}

/** A run of routes that share a probability band, in descending order of chance. */
export interface RouteGroup {
  /** Lower bound of the band, in percent — also the group's identity. */
  floor: number;
  label: string;
  routes: Route[];
}

/**
 * Bands routes by market-implied chance. Bounds mirror polymarketRiskLevel in
 * @/lib/polymarket-routes so a band means the same thing here as it does when the
 * pool is built: 85+ high confidence, 65-84 likely, 35-64 a coin-flip-ish call,
 * under 35 a long shot.
 */
const CHANCE_BANDS: readonly { floor: number; label: string }[] = [
  { floor: 85, label: 'Very likely' },
  { floor: 65, label: 'Likely' },
  { floor: 35, label: 'Toss-up' },
  { floor: 0, label: 'Long shot' },
];

/**
 * Whether the prediction-only facets are live. They apply only while a prediction
 * asset class is selected — the panel that sets them is hidden otherwise, and a
 * filter the user cannot see narrowing the list is a bug, not a feature. State is
 * kept rather than cleared so returning to prediction markets restores the picks.
 */
export function predictionFacetsActive(filters: RouteFilters): boolean {
  return isPredictionCategory(filters.category);
}

/** The keyword actually in force: only while the prediction facets are live. */
export function activeKeyword(filters: RouteFilters): string {
  return predictionFacetsActive(filters) ? filters.keyword.trim() : '';
}

/**
 * Whether a route reads as a match for the typed words. Matches on the text the
 * user can actually see — description and line — so a hit is always explicable by
 * looking at the card. Every word must appear, which makes "messi ronaldo" narrow
 * rather than widen.
 */
export function routeMatchesKeyword(route: Route, keyword: string): boolean {
  const words = keyword.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = `${route.description} ${route.line ?? ''}`.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

export function groupRoutesByChance(routes: Route[]): RouteGroup[] {
  return CHANCE_BANDS
    .map(({ floor, label }, index) => {
      // Bands are listed descending, so this band's ceiling is the previous band's
      // floor. Deriving it by searching for "a larger floor" would find the largest
      // one every time and make the lower bands overlap.
      const ceiling = index === 0 ? Infinity : CHANCE_BANDS[index - 1].floor;
      return {
        floor,
        label,
        routes: routes.filter((route) => route.probability >= floor && route.probability < ceiling),
      };
    })
    .filter((group) => group.routes.length > 0);
}

export function resolveInvestmentAmount(editedAmount: number | null, referenceStake: number): number {
  return editedAmount ?? referenceStake;
}

/**
 * Near-miss relevance. A route that MISSES the goal at the amount the user actually
 * intends to invest is only worth showing if it's close on BOTH axes: close to the goal,
 * and reachable without demanding far more capital than the user wants to put in. Otherwise
 * it's noise (e.g. a T-bill projecting +$199 toward a +$300 goal that would need $3k more).
 * Thresholds are reciprocals by design (1 / 0.8 = 1.25), so for a route whose return scales
 * linearly with stake the two checks coincide; both are kept so non-linear routes still get
 * judged on each axis.
 */
export const NEAR_MISS_MIN_PROXIMITY = 0.8; // show only if projected ≥ 80% of the goal
export const NEAR_MISS_MAX_STAKE_STRETCH = 1.25; // …and reachable within 1.25× the intended amount

export interface RouteRelevanceInput {
  target: number;
  projectedReturn: number; // profit at the user's INTENDED stake (not an auto-sized one)
  requiredInvestment: number | null; // stake needed to actually hit the goal
  intendedInvestment: number; // what the user wants to invest
}

export function isRelevantRoute({
  target,
  projectedReturn,
  requiredInvestment,
  intendedInvestment,
}: RouteRelevanceInput): boolean {
  if (target <= 0) return true; // no goal set → nothing to be irrelevant against
  if (projectedReturn >= target) return true; // hits the goal at the intended amount → always show
  const closeToGoal = projectedReturn >= target * NEAR_MISS_MIN_PROXIMITY;
  const withinPriceRange =
    requiredInvestment != null &&
    intendedInvestment > 0 &&
    requiredInvestment <= intendedInvestment * NEAR_MISS_MAX_STAKE_STRETCH;
  return closeToGoal && withinPriceRange;
}

export function buildRouteResults(
  routes: Route[],
  params: RouteParams,
  investment: number,
  filters: RouteFilters
): RouteResults {
  const referenceStake = params.balance || 1;
  const target = params.target || 1;
  const intendedInvestment = investment || target || referenceStake;
  const requiredInvestmentById = new Map(
    routes.map((route) => [
      route.id,
      stakeNeededForReturn(route, referenceStake, target),
    ] as const)
  );
  // Drop irrelevant near-misses before anything else, so scores, ranking, and the
  // "N ways to make $X" count all reflect only routes worth showing, judged against
  // the amount the user said they are willing to invest. A keyword search is the one
  // exception: the user named what they want, so hiding a match for missing the goal
  // would look broken. The score and the "below current goal" label still say so.
  const keyword = activeKeyword(filters);
  const relevantRoutes = keyword
    ? routes
    : routes.filter((route) =>
      isRelevantRoute({
        target,
        projectedReturn: rescoreForStake([route], referenceStake, intendedInvestment, target)[0].expectedReturn,
        requiredInvestment: requiredInvestmentById.get(route.id) ?? null,
        intendedInvestment,
      })
    );
  // Spend only what a route needs to reach the target, never more than the user
  // is willing to invest.
  const selectedStake = (route: Route): number => {
    const requiredInvestment = requiredInvestmentById.get(route.id);
    return Math.min(requiredInvestment ?? intendedInvestment, intendedInvestment);
  };
  const rescored = relevantRoutes.map((route) => (
    rescoreForStake([route], referenceStake, selectedStake(route), target)[0]
  ));
  const scoreContext = (route: Route): GoalScoreContext => ({
    target,
    requiredInvestment: requiredInvestmentById.get(route.id) ?? null,
    availableInvestment: intendedInvestment,
    deadlineDays: timeframeCalendarDays(params.timeframe),
  });
  const scoreById = new Map(
    rescored.map((route) => [route.id, goalEffectivenessScore(route, scoreContext(route))] as const)
  );
  const ranked = sortByPatheyScore(rescored, scoreContext);

  let filtered = ranked;
  if (filters.category) filtered = filtered.filter((route) => route.category === filters.category);
  if (filters.lossProfile) filtered = filtered.filter((route) => route.lossProfile === filters.lossProfile);
  if (filters.minimumProbability > 0) {
    filtered = filtered.filter((route) => route.probability >= filters.minimumProbability);
  }
  if (predictionFacetsActive(filters)) {
    if (keyword) filtered = filtered.filter((route) => routeMatchesKeyword(route, keyword));
    // A route with no topic is unknown, not a non-match, but it still cannot satisfy a
    // topic the user asked for — so it drops out while a topic filter is active.
    if (filters.predictionTopic) {
      filtered = filtered.filter((route) => route.predictionTopic === filters.predictionTopic);
    }
    if (filters.maxDaysToResolve != null) {
      const limit = filters.maxDaysToResolve;
      filtered = filtered.filter((route) => (route.maturesInDays ?? Infinity) <= limit);
    }
  }
  if (filters.sort !== 'score') filtered = [...filtered].sort(sortComparator(filters.sort));

  return { ranked, filtered, requiredInvestmentById, scoreById, selectedStake };
}

// ── self-check ──────────────────────────────────────────────────────────────
export function __selfCheck(): void {
  if (resolveInvestmentAmount(null, 1000) !== 1000) {
    throw new Error('an untouched investment amount uses the saved default');
  }
  if (resolveInvestmentAmount(0, 1000) !== 0) {
    throw new Error('a temporarily empty investment input stays empty while editing');
  }

  // The reported case: +$300 goal, intends $4,901; T-bill projects +$199 and needs $7,378.
  const tbill = { target: 300, projectedReturn: 199, requiredInvestment: 7378, intendedInvestment: 4901 };
  console.assert(!isRelevantRoute(tbill), 'far-off T-bill (66% of goal, 1.5× capital) is hidden');

  // Hits the goal at the intended amount → always shown.
  console.assert(
    isRelevantRoute({ target: 300, projectedReturn: 300, requiredInvestment: 4901, intendedInvestment: 4901 }),
    'route that hits the goal at the intended amount is shown',
  );

  // Genuine near-miss: 81% of goal, needs only ~1.23× the intended amount → shown.
  console.assert(
    isRelevantRoute({ target: 300, projectedReturn: 244, requiredInvestment: 6000, intendedInvestment: 4901 }),
    'near-miss within both bars is shown',
  );

  // Just over the price-range line (needs >1.25× intended) → hidden.
  console.assert(
    !isRelevantRoute({ target: 300, projectedReturn: 235, requiredInvestment: 6200, intendedInvestment: 4901 }),
    'needs more than 1.25× the intended amount → hidden',
  );

  // Route that can never reach the goal at any stake (no required investment) → hidden.
  console.assert(
    !isRelevantRoute({ target: 300, projectedReturn: 150, requiredInvestment: null, intendedInvestment: 4901 }),
    'route with no path to the goal is hidden',
  );

  // No goal set → never filtered.
  console.assert(
    isRelevantRoute({ target: 0, projectedReturn: 0, requiredInvestment: null, intendedInvestment: 4901 }),
    'no goal → nothing is filtered out',
  );

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
    activeKeyword({ ...filters, keyword: 'messi' }) === '',
    'a keyword does not apply while the prediction facets are hidden',
  );
  console.assert(
    buildRouteResults([messi, tesla], params, 1000, { ...filters, keyword: 'messi' }).filtered.length === 2,
    'a keyword set outside the prediction class leaves the list alone',
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

function sortComparator(sort: Exclude<RouteSort, 'score'>): (a: Route, b: Route) => number {
  switch (sort) {
    case 'safest':
      return (a, b) => {
        const risk = a.riskLevel - b.riskLevel;
        const lossShape = Number(a.lossProfile === 'binary') - Number(b.lossProfile === 'binary');
        return risk || lossShape || b.probability - a.probability;
      };
    case 'chance': return (a, b) => b.probability - a.probability;
    case 'payout': return (a, b) => b.expectedReturn - a.expectedReturn;
    case 'soonest': return (a, b) => (a.maturesInDays ?? Number.MAX_SAFE_INTEGER) - (b.maturesInDays ?? Number.MAX_SAFE_INTEGER);
    case 'type': return (a, b) => a.category.localeCompare(b.category);
  }
}
