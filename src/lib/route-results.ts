import { timeframeCalendarDays } from '@/api/client/playbook';
import { isPredictionCategory } from '@/lib/prediction-topics';
import { goalEffectivenessScore, sortByPatheyScore } from '@/lib/score';
import type { GoalScoreBreakdown, GoalScoreContext } from '@/lib/score';
import { expectedValue } from '@/lib/route-expected-value';
import { rescoreForStake, stakeNeededForReturn } from '@/lib/stake-rescore';
import type { Route, RouteParams } from '@/types/routes';

export type RouteSort = 'score' | 'chance' | 'payout' | 'value' | 'soonest' | 'type';

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
  /**
   * Smallest amount the user would have to be willing to invest for a route at or above
   * `minimumProbability` to reappear, or null if raising it would not help.
   */
  unlockInvestmentFor: (minimumProbability: number) => number | null;
  /**
   * Smallest amount the user would have to be willing to invest for a capital-preserving
   * route to reach the goal, or null when raising it would not help — either no such
   * route exists in the pool at any amount, or one is already affordable.
   */
  unlockCapitalSafeInvestment: number | null;
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

/**
 * The keyword actually in force. Unlike the topic and resolution facets, this one
 * applies in every asset class: the search bar sits above the filters and is always
 * visible, so a keyword narrowing the list is always explained by a control the user
 * can see.
 */
export function activeKeyword(filters: RouteFilters): string {
  return filters.keyword.trim();
}

/**
 * Whether a route reads as a match for the typed words. Matches on the text the
 * user can actually see on the card — description, line, category and platform — so
 * a hit is always explicable by looking at it. Every word must appear, which makes
 * "messi ronaldo" narrow rather than widen.
 */
export function routeMatchesKeyword(route: Route, keyword: string): boolean {
  const words = keyword.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = `${route.description} ${route.line ?? ''} ${route.category} ${route.platform}`.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

/**
 * What a search actually turned up, as one of four states. They are different
 * problems with different answers, and collapsing them into "no results" is what
 * makes a search feel broken: "we don't cover Dogecoin" is a coverage fact, while
 * "your risk filter is hiding it" is a control the user can move.
 *
 * `matchCount` counts routes matching the keyword BEFORE the filter chips apply;
 * `shownCount` counts what survives them.
 */
export type SearchOutcome = 'idle' | 'searching' | 'uncovered' | 'filtered-out' | 'found';

export function searchOutcome({ keyword, matchCount, shownCount, isSearching }: {
  keyword: string;
  matchCount: number;
  shownCount: number;
  isSearching: boolean;
}): SearchOutcome {
  if (!keyword.trim()) return 'idle';
  // Order matters: a search still in flight has no results yet, and calling that
  // "we don't cover it" would flash a wrong answer on every keystroke.
  if (isSearching) return 'searching';
  if (matchCount === 0) return 'uncovered';
  return shownCount === 0 ? 'filtered-out' : 'found';
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

/**
 * Asset classes, as the routes list sections them.
 *
 * Prediction-market contracts and ETFs/treasuries answer different questions and carry
 * different failure modes, so they are never blended into one ranked column: a binary
 * contract sitting at the top of a mixed list reads as "our top pick", where the honest
 * framing is "here is the best of each kind". Ranking is preserved *within* a section.
 */
export type RouteAssetClass = 'cash' | 'funds' | 'crypto' | 'other' | 'prediction';

export interface RouteAssetSection {
  assetClass: RouteAssetClass;
  label: string;
  /** One line under the header saying what kind of instrument the section holds. */
  note: string;
  routes: Route[];
}

/**
 * Section order, safest instrument class first. Prediction markets sit last on purpose —
 * not hidden, but never the thing the list opens with.
 */
const ASSET_SECTIONS: readonly { assetClass: RouteAssetClass; label: string; note: string }[] = [
  {
    assetClass: 'cash',
    label: 'Treasuries & cash',
    note: 'Contractual yields. The return is known if held to maturity.',
  },
  {
    assetClass: 'funds',
    label: 'Stocks & ETFs',
    note: "Estimated from each fund's own recent volatility and long-run trend.",
  },
  {
    assetClass: 'crypto',
    label: 'Crypto',
    note: 'Estimated from recent volatility. No contractual return.',
  },
  {
    assetClass: 'other',
    label: 'Other markets',
    note: '',
  },
  {
    assetClass: 'prediction',
    label: 'Prediction markets',
    note: 'Market-implied probabilities from live contract prices. A binary contract settles at its full value or at nothing.',
  },
];

/** Which section a route belongs to, read off what it actually is. */
export function routeAssetClass(route: Route): RouteAssetClass {
  const text = `${route.category} ${route.platform}`;
  if (/savings|treasur/i.test(text)) return 'cash';
  if (/stock|etf|fund/i.test(text)) return 'funds';
  if (/crypto|coin/i.test(text)) return 'crypto';
  if (isPredictionCategory(route.category) || /polymarket|kalshi|prediction|sport/i.test(text)) {
    return 'prediction';
  }
  // A route that risks everything on one outcome belongs with the contracts even when
  // its category names no venue we recognise.
  return route.lossProfile === 'binary' ? 'prediction' : 'other';
}

/**
 * Splits a ranked list into asset-class sections, preserving each route's rank inside
 * its own section. Empty sections are omitted.
 */
export function groupRoutesByAssetClass(routes: Route[]): RouteAssetSection[] {
  return ASSET_SECTIONS
    .map((section) => ({
      ...section,
      routes: routes.filter((route) => routeAssetClass(route) === section.assetClass),
    }))
    .filter((section) => section.routes.length > 0);
}

/**
 * Whether the list should be sectioned by asset class. Only in the default view: once
 * the user picks one asset class, or sorts by something else, or searches by name, they
 * have asked for a single ordered list and headers repeating what they just chose are
 * noise.
 */
export function assetSectionsActive(filters: RouteFilters): boolean {
  return filters.category === null && filters.sort === 'score' && activeKeyword(filters) === '';
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

/**
 * Whether to offer the "invest more and capital-preserving routes appear" nudge.
 *
 * Three conditions, each of them about not misleading the user:
 *  - nothing currently listed preserves capital, so the offer is news rather than nagging;
 *  - some amount genuinely unlocks one, so it never promises a route that does not exist;
 *  - the user has not asked for all-or-nothing, narrowed to a single asset class, or
 *    searched for a market by name — in each case the absent safe routes are their own
 *    choice rather than a budget problem, and "everything here is all-or-nothing" is
 *    just a restatement of what they typed.
 *
 * Judged on the whole filtered list rather than the visible page: a capital-preserving
 * route sitting on page two would make "everything here is all-or-nothing" a lie.
 */
export function shouldOfferCapitalSafe(
  filters: RouteFilters,
  filteredRoutes: Route[],
  unlockAmount: number | null,
): boolean {
  if (unlockAmount == null) return false;
  if (filters.lossProfile != null || filters.category != null) return false;
  if (activeKeyword(filters) !== '') return false;
  return !filteredRoutes.some((route) => route.lossProfile === 'partial');
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
  if (keyword) filtered = filtered.filter((route) => routeMatchesKeyword(route, keyword));
  if (predictionFacetsActive(filters)) {
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
  if (filters.sort !== 'score') filtered = [...filtered].sort(sortComparator(filters.sort, selectedStake));

  // A high chance of hitting the goal is the property of safe, low-yield routes, and those
  // need real capital: a T-bill clears a $300 goal only at a few thousand dollars. So they
  // are the first to be dropped as unreachable near-misses when the intended amount is
  // small, and "no routes with ≥ 90% chance" is usually a budget message rather than a
  // market one. This is the number that answers it. Null when more money would not help —
  // no such route exists, or one is already affordable and another filter is hiding it.
  const unlockInvestmentFor = (minimumProbability: number): number | null => {
    const needed = routes
      .filter((route) => route.probability >= minimumProbability)
      .filter((route) => !filters.category || route.category === filters.category)
      .filter((route) => !filters.lossProfile || route.lossProfile === filters.lossProfile)
      .map((route) => requiredInvestmentById.get(route.id))
      .filter((amount): amount is number => amount != null && amount > intendedInvestment);
    return needed.length > 0 ? Math.min(...needed) : null;
  };

  // The same question asked of capital preservation instead of probability. A user with a
  // small budget and a big goal gets a list of nothing but binary contracts — not because
  // the safe routes are missing, but because a T-bill needs real capital to clear a +$300
  // goal and `isRelevantRoute` dropped it as unreachable. Silence there is what makes the
  // app look like it only deals in all-or-nothing bets, so this is the number that answers
  // it. Read off the whole pool, not the filtered list, since the point is what is absent.
  const capitalSafeCandidates = routes
    .filter((route) => route.lossProfile === 'partial')
    .map((route) => requiredInvestmentById.get(route.id))
    .filter((amount): amount is number => amount != null && amount > intendedInvestment);
  const unlockCapitalSafeInvestment = capitalSafeCandidates.length > 0
    ? Math.min(...capitalSafeCandidates)
    : null;

  return {
    ranked,
    filtered,
    requiredInvestmentById,
    scoreById,
    selectedStake,
    unlockInvestmentFor,
    unlockCapitalSafeInvestment,
  };
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

  // ── asset-class sections ──────────────────────────────────────────────────
  const cashRoute: Route = { ...reportedRoute, id: 'tbill', category: 'Savings & Treasuries', platform: 'TreasuryDirect', lossProfile: 'partial' };
  const fundRoute: Route = { ...reportedRoute, id: 'voo', category: 'Stocks & ETFs', platform: 'Brokerage', lossProfile: 'partial' };
  const coinRoute: Route = { ...reportedRoute, id: 'btc', category: 'Crypto', platform: 'Coinbase', lossProfile: 'partial' };
  const sections = groupRoutesByAssetClass([reportedRoute, coinRoute, cashRoute, fundRoute]);
  console.assert(
    sections.map((section) => section.assetClass).join(',') === 'cash,funds,crypto,prediction',
    'sections run safest class first, with prediction markets last',
  );
  console.assert(
    sections.every((section) => section.routes.length === 1),
    'every route lands in exactly one section',
  );
  console.assert(
    routeAssetClass({ ...reportedRoute, category: 'Sports Betting', platform: 'Sportsbook' }) === 'prediction',
    'a legacy sports category still sections with prediction markets',
  );
  console.assert(
    routeAssetClass({ ...reportedRoute, category: 'Forex', platform: 'Broker', lossProfile: 'partial' }) === 'other',
    'an unrecognised non-binary category falls through to Other',
  );
  console.assert(
    groupRoutesByAssetClass([cashRoute]).length === 1,
    'sections with no routes are omitted rather than rendered empty',
  );
  console.assert(
    assetSectionsActive(filters)
      && !assetSectionsActive({ ...filters, category: 'Polymarket' })
      && !assetSectionsActive({ ...filters, sort: 'chance' })
      && !assetSectionsActive({ ...filters, keyword: 'messi' }),
    'sections show only in the default unfiltered, unsorted, unsearched view',
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

function sortComparator(
  sort: Exclude<RouteSort, 'score'>,
  stakeFor: (route: Route) => number,
): (a: Route, b: Route) => number {
  switch (sort) {
    case 'chance': return (a, b) => b.probability - a.probability;
    // 'payout' is the headline win-only figure, honest to its label. 'value' weights
    // that payout by the odds, so a longshot stops outranking a T-bill by default.
    case 'payout': return (a, b) => b.expectedReturn - a.expectedReturn;
    case 'value': return (a, b) => expectedValue(b, stakeFor(b)) - expectedValue(a, stakeFor(a));
    case 'soonest': return (a, b) => (a.maturesInDays ?? Number.MAX_SAFE_INTEGER) - (b.maturesInDays ?? Number.MAX_SAFE_INTEGER);
    case 'type': return (a, b) => a.category.localeCompare(b.category);
  }
}
