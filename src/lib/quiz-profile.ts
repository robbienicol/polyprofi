import { QuizAnswers } from '@/types/bets';
import { Route, RouteParams } from '@/types/routes';
import { playbookRiskBounds } from '@/api/client/playbook';

/**
 * A near-coinflip binary bet is never "Safe", no matter what riskLevel the LLM assigned —
 * losing it loses 100% of the stake. Only raises riskLevel, never lowers an LLM call that
 * was already more conservative than this floor.
 */
function binaryRiskFloor(probability: number): number {
  if (probability >= 90) return 1;
  if (probability >= 75) return 2;
  if (probability >= 60) return 3;
  return 4;
}

/**
 * Re-derives riskLevel (binary-loss floor) and meetsTarget (expectedReturn vs the real $
 * target) instead of trusting the LLM's self-reported values — the same fix as the
 * playbook riskLevel determinism, applied to every AI-generated route too. Without this,
 * a $5-profit pick can claim meetsTarget:true against a $300 goal and a 56%-probability
 * coinflip bet can claim riskLevel:"Safe", and nothing downstream catches either.
 */
export function enforceRouteIntegrity(routes: Route[], target: number): Route[] {
  return routes.map((r) => {
    const riskLevel = r.lossProfile === 'binary'
      ? Math.max(r.riskLevel, binaryRiskFloor(r.probability))
      : r.riskLevel;
    const meetsTarget = r.expectedReturn >= target;
    return { ...r, riskLevel, meetsTarget };
  });
}

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
  Stocks: ['Stocks & ETFs', 'Stocks', 'Savings & Treasuries'],
};

const LONG_TIMEFRAMES = new Set<QuizAnswers['timeframe']>(['1year', '5years']);
const MID_TIMEFRAMES = new Set<QuizAnswers['timeframe']>(['3months']);
const SHORT_TIMEFRAMES = new Set<QuizAnswers['timeframe']>(['today', 'week']);

/**
 * Routes may resolve slightly after the selected deadline, but not in a different
 * investing horizon. The grace window grows conservatively with the timeframe.
 */
export const TIMEFRAME_MATURITY_LIMITS: Record<QuizAnswers['timeframe'], number> = {
  today: 2,
  week: 10,
  month: 37,
  '3months': 104,
  '1year': 395,
  '5years': 1915,
};

export function timeframeMaturityLimit(timeframe: QuizAnswers['timeframe']): number {
  return TIMEFRAME_MATURITY_LIMITS[timeframe];
}

function routeFitsTimeframe(route: Route, timeframe: QuizAnswers['timeframe']): boolean {
  // A liquid (capital-preserved) route with no fixed maturity can be exited any time, so an
  // unknown maturesInDays is fine. A binary route (Polymarket) is locked until resolution —
  // an unresolved/unknown end date must not be waved through as "matches the deadline."
  if (route.maturesInDays == null) return route.lossProfile !== 'binary';
  return Number.isFinite(route.maturesInDays)
    && route.maturesInDays > 0
    && route.maturesInDays <= timeframeMaturityLimit(timeframe);
}

/**
 * Timeframe + return target set how strict routes are.
 * Long + modest goal → safer cap (VOO/T-bill territory dominates).
 * Short + aggressive → wider net but still ranked safest-first.
 */
function deriveRiskBounds(
  timeframe: QuizAnswers['timeframe'],
  returnPct: number
): { maxRiskLevel: number; minProbability: number } {
  const modest = returnPct <= 15;
  const aggressive = returnPct >= 50;

  let bounds: { maxRiskLevel: number; minProbability: number };
  if (LONG_TIMEFRAMES.has(timeframe) && modest) {
    bounds = { maxRiskLevel: 3, minProbability: 55 };
  } else if (LONG_TIMEFRAMES.has(timeframe)) {
    bounds = { maxRiskLevel: 4, minProbability: 40 };
  } else if (MID_TIMEFRAMES.has(timeframe) && modest) {
    // 3 months: too short for safe instruments to hit >5%, so show moderate-risk options honestly
    bounds = { maxRiskLevel: 4, minProbability: 30 };
  } else if (MID_TIMEFRAMES.has(timeframe)) {
    bounds = { maxRiskLevel: 5, minProbability: 20 };
  } else if (SHORT_TIMEFRAMES.has(timeframe) && aggressive) {
    bounds = { maxRiskLevel: 5, minProbability: 15 };
  } else if (SHORT_TIMEFRAMES.has(timeframe)) {
    bounds = { maxRiskLevel: 4, minProbability: 35 };
  } else {
    // month, etc.
    bounds = modest
      ? { maxRiskLevel: 3, minProbability: 45 }
      : { maxRiskLevel: 4, minProbability: 30 };
  }

  // Never be stricter than what the app's own calibrated baseline can deliver for this
  // exact goal — otherwise an aggressive short-term target (e.g. 100%/month, realistically
  // ~4-6% via OTM options) gets its own grounded recommendation filtered out to zero results.
  const calibrated = playbookRiskBounds(returnPct, timeframe);
  const result = {
    maxRiskLevel: Math.max(bounds.maxRiskLevel, calibrated.maxRiskLevel),
    minProbability: Math.min(bounds.minProbability, calibrated.minProbability),
  };
  if (result.minProbability !== bounds.minProbability || result.maxRiskLevel !== bounds.maxRiskLevel) {
    console.log(
      `[quiz-profile] ${returnPct.toFixed(1)}%/${timeframe}: heuristic bounds ${JSON.stringify(bounds)} relaxed to ${JSON.stringify(result)} to match calibrated baseline (else the app's own grounded pick gets filtered out)`
    );
  }
  return result;
}

function applyRiskTolerance(
  bounds: { maxRiskLevel: number; minProbability: number },
  riskTolerance: QuizAnswers['riskTolerance']
): { maxRiskLevel: number; minProbability: number } {
  if (riskTolerance === 'conservative') {
    return {
      maxRiskLevel: Math.min(bounds.maxRiskLevel, 3),
      minProbability: Math.max(bounds.minProbability, 55),
    };
  }
  if (riskTolerance === 'aggressive') {
    return {
      maxRiskLevel: 5,
      minProbability: Math.min(bounds.minProbability, 15),
    };
  }
  return bounds;
}

/**
 * The profile survey's amount buckets, as the top of each range in dollars — what the
 * user told us they are willing to put in. "$100,000+" is open-ended, so it is held at
 * its floor rather than invented upward. Keep the keys in sync with AMOUNTS in
 * `@/app/profile-survey`; an unrecognised answer (or "Prefer not to say") yields null
 * and the goal-derived stake is used instead.
 */
const SURVEY_AMOUNT_CEILING: Record<string, number> = {
  'Under $1,000': 1_000,
  '$1,000 - $5,000': 5_000,
  '$5,000 - $25,000': 25_000,
  '$25,000 - $100,000': 100_000,
  '$100,000+': 100_000,
};

export function surveyAmountCeiling(investmentAmount: string | null | undefined): number | null {
  if (!investmentAmount) return null;
  return SURVEY_AMOUNT_CEILING[investmentAmount] ?? null;
}

/**
 * Reference stake used to generate the route pool. The invest amount isn't asked
 * up front any more — it's a live slider on the results screen — so pick one
 * generous enough that the pool spans treasuries → longshots for any target.
 *
 * The survey ceiling raises it because the pool has to contain routes that are
 * actually sized for the user's capital: a $100 goal alone caps this at $1,000, which
 * is why someone with $25,000 to deploy used to find the slider pinned at $1,000.
 */
export function referenceStakeFor(target: number, investmentCeiling?: number | null): number {
  const goalDerived = Math.max(1000, (target || 100) * 10);
  return investmentCeiling && investmentCeiling > 0
    ? Math.max(goalDerived, investmentCeiling)
    : goalDerived;
}

/**
 * Top of the invest slider. Doubling the expected amount is the point: a track that ends
 * exactly at the default leaves the thumb pinned to the right with nowhere to drag, and
 * raising the amount is the one move that brings safe, high-probability routes into
 * range — they need capital, not luck. Someone who said "up to $10,000" can still reach
 * $20,000 without typing.
 */
export function investmentSliderMaximum(
  referenceStake: number,
  investmentCeiling?: number | null,
): number {
  const base = investmentCeiling && investmentCeiling > 0 ? investmentCeiling : referenceStake;
  return Math.max(1, base) * 2;
}

export function buildRouteParams(answers: Omit<QuizAnswers, 'maxRiskLevel' | 'minProbability'>): QuizAnswers {
  const returnPct = answers.balance > 0 ? (answers.target / answers.balance) * 100 : 0;
  const bounds = deriveRiskBounds(answers.timeframe, returnPct);
  const riskTolerance = answers.riskTolerance ?? 'balanced';
  return { ...answers, riskTolerance, ...applyRiskTolerance(bounds, riskTolerance) };
}

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
function sortSafestFirst(routes: Route[]): Route[] {
  return [...routes].sort((a, b) => {
    const safeFirst = a.riskLevel - b.riskLevel;
    if (safeFirst !== 0) return safeFirst;
    const capitalFirst = Number(a.lossProfile === 'binary') - Number(b.lossProfile === 'binary');
    if (capitalFirst !== 0) return capitalFirst;
    return b.probability - a.probability;
  });
}

/** Client-side filter so quiz categories & risk bounds actually shape the feed. */
export function filterRoutesForQuiz(routes: Route[], params: RouteParams): Route[] {
  let result = routes.filter(
    (r) =>
      r.riskLevel <= params.maxRiskLevel
      && r.probability >= params.minProbability
      && routeFitsTimeframe(r, params.timeframe)
  );

  if (params.categories.length > 0) {
    const matched = result.filter((r) => routeMatchesCategories(r, params.categories));
    // Keep baseline safe routes (ETF/treasury) even when filtering narrow markets
    const baselines = result.filter((r) =>
      /etf|treasury|savings|hysa|broad/i.test(`${r.category} ${r.strategy} ${r.platform}`)
    );
    result = [...new Map([...matched, ...baselines].map((r) => [r.id, r])).values()];
  }

  // Applied last, and to the baseline rescue above as well: a market someone asked
  // us to leave out does not come back in through the safe-route back door.
  const excluded = params.excludedCategories ?? [];
  if (excluded.length > 0) {
    result = result.filter((r) => !routeMatchesCategories(r, excluded));
  }

  return sortSafestFirst(result);
}

export function isLongHorizon(timeframe: QuizAnswers['timeframe']): boolean {
  return LONG_TIMEFRAMES.has(timeframe);
}

// ── self-check ──────────────────────────────────────────────────────────────
export function __selfCheck(): void {
  const base: Omit<Route, 'id' | 'riskLevel' | 'probability'> = {
    category: 'Stocks & ETFs', emoji: '📈', description: '', expectedReturn: 10,
    lossProfile: 'partial', meetsTarget: true, platform: '', strategy: '',
  };
  const voo: Route = { ...base, id: 'voo', riskLevel: 1, probability: 60 };
  const longshot: Route = { ...base, id: 'longshot', riskLevel: 5, probability: 95 };
  const sorted = sortSafestFirst([longshot, voo]);
  console.assert(sorted[0].id === 'voo', 'low risk ranks above high probability — risk is the primary key, not probability');

  const tieA: Route = { ...base, id: 'tieA', riskLevel: 2, probability: 40 };
  const tieB: Route = { ...base, id: 'tieB', riskLevel: 2, probability: 70 };
  const tieSorted = sortSafestFirst([tieA, tieB]);
  console.assert(tieSorted[0].id === 'tieB', 'same risk → higher probability wins the tiebreak');

  // same riskLevel, partial beats binary even when binary has the better odds
  const stock: Route = { ...base, id: 'stock', riskLevel: 2, lossProfile: 'partial', probability: 50 };
  const sportsBet: Route = { ...base, id: 'sportsBet', riskLevel: 2, lossProfile: 'binary', probability: 90 };
  const capitalSorted = sortSafestFirst([sportsBet, stock]);
  console.assert(capitalSorted[0].id === 'stock', 'capital-preserved beats all-or-nothing at equal riskLevel, regardless of odds');

  // the exact bug report: 100%/month must not require a probability floor the app's own
  // baseline (OTM options, ~4%) can't clear — that's how "100% in a month" returned 0 routes.
  const extreme = deriveRiskBounds('month', 100);
  console.assert(extreme.minProbability <= 6, '100%/month floor must drop to what OTM options/crypto altcoin can realistically hit');
  console.assert(extreme.maxRiskLevel >= 5, '100%/month must allow riskLevel 5 (OTM options) through');

  // sanity: a modest long-horizon goal should stay conservative — the fix must not blow the cap open everywhere
  const modestLong = deriveRiskBounds('1year', 8);
  console.assert(modestLong.maxRiskLevel <= 3, 'modest 1-year goal stays capped at low risk');

  // the exact reported bug: a 56%-probability binary bet self-labeled riskLevel 2 ("Safe")
  // must get bumped — a coinflip is not safe just because the LLM said so.
  const coinflip: Route = { ...base, id: 'coinflip', riskLevel: 2, lossProfile: 'binary', probability: 56, expectedReturn: 5 };
  const [fixed] = enforceRouteIntegrity([coinflip], 300);
  console.assert(fixed.riskLevel >= 3, '56% binary bet must be bumped off riskLevel 2 ("Safe")');
  console.assert(fixed.meetsTarget === false, '$5 expectedReturn against a $300 target must be meetsTarget:false, not whatever the LLM claimed');

  // must never LOWER a riskLevel the LLM already called riskier than the floor
  const alreadyRisky: Route = { ...base, id: 'alreadyRisky', riskLevel: 5, lossProfile: 'binary', probability: 95, expectedReturn: 999 };
  const [untouched] = enforceRouteIntegrity([alreadyRisky], 300);
  console.assert(untouched.riskLevel === 5, 'floor only raises riskLevel, never lowers an already-conservative LLM call');

  // partial-loss routes are untouched by the binary floor
  const partialCoinflip: Route = { ...base, id: 'partialCoinflip', riskLevel: 2, lossProfile: 'partial', probability: 56, expectedReturn: 400 };
  const [partialResult] = enforceRouteIntegrity([partialCoinflip], 300);
  console.assert(partialResult.riskLevel === 2, 'binary floor does not apply to capital-preserved (partial) routes');
  console.assert(partialResult.meetsTarget === true, 'expectedReturn $400 >= $300 target → meetsTarget true');

  // The reported bug: a small profit goal pinned the slider at $1,000 no matter how much
  // the user said they had. The survey answer has to raise it.
  console.assert(referenceStakeFor(100) === 1000, 'a $100 goal alone still derives $1,000');
  console.assert(
    referenceStakeFor(100, surveyAmountCeiling('$5,000 - $25,000')) === 25_000,
    'the survey ceiling raises a small goal\'s reference stake to what the user actually has',
  );
  console.assert(
    referenceStakeFor(50_000, surveyAmountCeiling('Under $1,000')) === 500_000,
    'a large goal is not dragged down below the pool it needs',
  );
  console.assert(surveyAmountCeiling('Prefer not to say') === null, 'a skipped answer sets no ceiling');
  console.assert(surveyAmountCeiling(null) === null, 'a missing answer sets no ceiling');
  console.assert(
    investmentSliderMaximum(1000, 10_000) === 20_000,
    'the slider doubles the stated amount — "up to $10k" can be dragged to $20k',
  );
  console.assert(
    investmentSliderMaximum(1000, null) === 2000,
    'with no survey answer the slider still doubles the goal-derived stake',
  );

  const weekParams: RouteParams = {
    balance: 1000,
    target: 100,
    timeframe: 'week',
    categories: [],
    riskTolerance: 'balanced',
    maxRiskLevel: 5,
    minProbability: 0,
  };
  const nearWeek: Route = { ...voo, id: 'near-week', maturesInDays: 10 };
  const afterWeek: Route = { ...voo, id: 'after-week', maturesInDays: 11 };
  const twoYears: Route = { ...voo, id: 'two-years', maturesInDays: 730 };
  const weekRoutes = filterRoutesForQuiz([twoYears, afterWeek, nearWeek], weekParams);
  console.assert(
    weekRoutes.length === 1 && weekRoutes[0].id === 'near-week',
    'one-week quiz keeps the 10d near miss but hides 11d and two-year routes',
  );

  // the reported gap: "leave crypto out" has to hold even when no market was picked,
  // and it must not be undone by the safe-route rescue.
  const cryptoRoute: Route = { ...voo, id: 'crypto', category: 'Crypto' };
  const etfRoute: Route = { ...voo, id: 'etf', category: 'Stocks & ETFs', strategy: 'broad market ETF' };
  const noPreference: RouteParams = { ...weekParams, categories: [], excludedCategories: ['Crypto'] };
  const excluded = filterRoutesForQuiz([cryptoRoute, etfRoute], noPreference);
  console.assert(
    excluded.length === 1 && excluded[0].id === 'etf',
    'an excluded category is dropped even when categories is empty ("no preference" is not permission)',
  );
  const rescued = filterRoutesForQuiz(
    [cryptoRoute, etfRoute],
    { ...weekParams, categories: ['Polymarket'], excludedCategories: ['Stocks'] },
  );
  console.assert(
    rescued.every((route) => route.id !== 'etf'),
    'the ETF/treasury baseline rescue does not smuggle an excluded category back in',
  );
  console.assert(
    filterRoutesForQuiz([cryptoRoute, etfRoute], weekParams).length === 2,
    'a search saved before excludedCategories existed filters exactly as it used to',
  );

  // an unresolved Polymarket contract (no end date) must not get waved through as a match —
  // only a liquid/capital-preserved route can skip the maturity check.
  const unknownBinary: Route = { ...voo, id: 'unknown-binary', lossProfile: 'binary', maturesInDays: undefined };
  const unknownPartial: Route = { ...voo, id: 'unknown-partial', lossProfile: 'partial', maturesInDays: undefined };
  const unknownRoutes = filterRoutesForQuiz([unknownBinary, unknownPartial], weekParams);
  console.assert(
    unknownRoutes.length === 1 && unknownRoutes[0].id === 'unknown-partial',
    'unknown maturity hides binary (locked) routes but still passes liquid (partial) ones',
  );
}
