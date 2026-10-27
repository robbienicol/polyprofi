import { Route, RouteParams } from '@/types/routes';
import { routeFitsTimeframe } from '@/lib/quiz-profile/params';

/**
 * Map quiz market picks → the route categories the builders actually emit.
 *
 * One entry per class that produces routes, and no more. An unmapped pick falls through
 * to matching on its own name, which for a class nothing builds means an empty list —
 * so a category listed here that no builder emits is a promise the search cannot keep.
 */
const QUIZ_TO_ROUTE_CATEGORIES: Record<string, string[]> = {
  Polymarket: ['Polymarket'],
  Crypto: ['Crypto'],
  Stocks: ['Stocks & ETFs', 'Stocks', 'Savings & Treasuries', 'Options'],
};

function routeMatchesCategories(route: Route, quizCategories: string[]): boolean {
  const allowed = new Set(
    quizCategories.flatMap((c) => QUIZ_TO_ROUTE_CATEGORIES[c] ?? [c])
  );
  return [...allowed].some(
    (cat) =>
      route.category.toLowerCase().includes(cat.toLowerCase()) ||
      cat.toLowerCase().includes(route.category.toLowerCase())
  );
}

/**
 * The one ranking rule for the whole app: safest first.
 *   1) riskLevel ascending — the primary sort key.
 *   2) lossProfile — at the same riskLevel, capital-preserved ('partial') always beats
 *      all-or-nothing ('binary'). A stock that doesn't hit target still has your money;
 *      a contract that resolves against you doesn't. That asymmetry outranks raw
 *      probability.
 *   3) probability descending — last tiebreaker (and what the bar graph shows).
 * Exported so every screen that lists routes ranks them identically — duplicating this
 * comparator elsewhere is how a screen quietly ends up sorted "highest chance first".
 */
export function sortSafestFirst(routes: Route[]): Route[] {
  return [...routes].sort((a, b) => {
    const safeFirst = a.riskLevel - b.riskLevel;
    if (safeFirst !== 0) return safeFirst;
    const capitalFirst = Number(a.lossProfile === 'binary') - Number(b.lossProfile === 'binary');
    if (capitalFirst !== 0) return capitalFirst;
    return b.probability - a.probability;
  });
}

/**
 * How many routes of a requested asset class are kept when the risk bounds would
 * otherwise leave that class with none at all. Enough to show the class is real,
 * few enough that a class the bounds dislike can't dominate the feed.
 */
const MIN_ROUTES_PER_REQUESTED_CATEGORY = 3;

/**
 * Whether a route clears the probability floor.
 *
 * `probability` means two different things depending on the route, and one floor
 * applied to both is what made the whole feed prediction markets. On a binary
 * contract it is the chance of being paid at all — below the floor, the stake is
 * most likely gone, so the floor is exactly right. On a capital-preserving route
 * (an ETF, a coin, a T-bill) it is the chance of clearing the *full target move*;
 * missing it means a smaller gain or a dip you still own, not a loss of the stake.
 * Holding those to "60% chance of +10% this month" excluded every stock and coin
 * ever built, which is why ticking them in the quiz changed nothing.
 */
function clearsProbabilityFloor(route: Route, minProbability: number): boolean {
  return route.lossProfile === 'binary' ? route.probability >= minProbability : true;
}

/** Client-side filter so quiz categories & risk bounds actually shape the feed. */
export function filterRoutesForQuiz(routes: Route[], params: RouteParams): Route[] {
  const inTimeframe = routes.filter((r) => routeFitsTimeframe(r, params.timeframe));
  let result = inTimeframe.filter(
    (r) => r.riskLevel <= params.maxRiskLevel && clearsProbabilityFloor(r, params.minProbability)
  );

  if (params.categories.length > 0) {
    const matched = result.filter((r) => routeMatchesCategories(r, params.categories));
    // Keep baseline safe routes (ETF/treasury) even when filtering narrow markets
    const baselines = result.filter((r) =>
      /etf|treasury|savings|hysa|broad/i.test(`${r.category} ${r.strategy} ${r.platform}`)
    );
    result = [...new Map([...matched, ...baselines].map((r) => [r.id, r])).values()];

    // A class the user ticked must never come back empty. Crypto is the clearest
    // case — every coin is riskLevel 5, so any cap below that silently deleted the
    // answer — but the same holds for any class the bounds happen to dislike.
    // These are the safest few of what that class actually offers, nothing more.
    for (const category of params.categories) {
      if (result.some((r) => routeMatchesCategories(r, [category]))) continue;
      const rescued = sortSafestFirst(
        inTimeframe.filter((r) => routeMatchesCategories(r, [category]))
      ).slice(0, MIN_ROUTES_PER_REQUESTED_CATEGORY);
      result = [...new Map([...result, ...rescued].map((r) => [r.id, r])).values()];
    }
  }

  // Applied last, and to the baseline rescue above as well: a market someone asked
  // us to leave out does not come back in through the safe-route back door.
  //
  // An exclusion never beats an explicit pick, though. The excluded list is built
  // once from the onboarding survey and never recomputed, so without this a user
  // who avoided crypto at signup and then ticked Crypto in the quiz had it stripped
  // out again with nothing on screen to say why.
  const requested = new Set(params.categories);
  const excluded = (params.excludedCategories ?? []).filter((category) => !requested.has(category));
  if (excluded.length > 0) {
    result = result.filter((r) => !routeMatchesCategories(r, excluded));
  }

  return sortSafestFirst(result);
}

