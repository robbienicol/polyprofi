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

/** Map quiz market picks → route card categories from the AI. */
const QUIZ_TO_ROUTE_CATEGORIES: Record<string, string[]> = {
  'Sports Predictions': ['Sports Betting', 'Sports', 'Polymarket'],
  Polymarket: ['Polymarket'],
  Crypto: ['Crypto'],
  Stocks: ['Stocks & ETFs', 'Stocks', 'Savings & Treasuries'],
  Forex: ['Forex'],
};

const LONG_TIMEFRAMES = new Set<QuizAnswers['timeframe']>(['1year', '5years']);
const MID_TIMEFRAMES = new Set<QuizAnswers['timeframe']>(['3months']);
const SHORT_TIMEFRAMES = new Set<QuizAnswers['timeframe']>(['today', 'week']);

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
 *      a losing sports/Polymarket bet doesn't. That asymmetry outranks raw odds.
 *   3) probability descending — last tiebreaker (and what the bar graph shows).
 * Exported so every screen that lists routes ranks them identically — duplicating this
 * comparator elsewhere is how a screen quietly ends up sorted "best odds first" instead.
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
    (r) => r.riskLevel <= params.maxRiskLevel && r.probability >= params.minProbability
  );

  if (params.categories.length > 0) {
    const matched = result.filter((r) => routeMatchesCategories(r, params.categories));
    // Keep baseline safe routes (ETF/treasury) even when filtering narrow markets
    const baselines = result.filter((r) =>
      /etf|treasury|savings|hysa|broad/i.test(`${r.category} ${r.strategy} ${r.platform}`)
    );
    result = [...new Map([...matched, ...baselines].map((r) => [r.id, r])).values()];
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
}
