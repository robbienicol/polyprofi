import { QuizAnswers } from '@/types/bets';
import { Route } from '@/types/routes';
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

export function routeFitsTimeframe(route: Route, timeframe: QuizAnswers['timeframe']): boolean {
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
export function deriveRiskBounds(
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
 * The profile survey's amount buckets, as the LOW end of each range in dollars — the
 * starting "willing to invest" on a search, which the user can see and change there.
 * It used to be the top of the range, so someone who ticked "$25,000 - $100,000" had
 * every search quietly sized to $100,000 and was shown routes tying up $20,000 to make
 * $300. The low end is what they have definitely said they have. "$100,000+" is
 * open-ended, so it is held at its floor rather than invented upward. Keep the keys in sync with AMOUNTS in
 * `@/app/profile-survey`; an unrecognised answer (or "Prefer not to say") yields null
 * and the goal-derived stake is used instead.
 */
const SURVEY_AMOUNT_CEILING: Record<string, number> = {
  'Under $1,000': 500,
  '$1,000 - $5,000': 1_000,
  '$5,000 - $25,000': 5_000,
  '$25,000 - $100,000': 25_000,
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

/** Timeframe as a person would say it at the end of a sentence. */
const TIMEFRAME_WORDS: Record<QuizAnswers['timeframe'], string> = {
  today: 'today',
  week: 'this week',
  month: 'this month',
  '3months': 'in 3 months',
  '1year': 'this year',
  '5years': 'in 5 years',
};

/** Market picks as words. Keys are the quiz's own `value`s — see MARKETS in app/quiz. */
const MARKET_WORDS: Record<string, string> = {
  Stocks: 'stocks',
  Crypto: 'crypto',
  Polymarket: 'prediction markets',
};

/**
 * One line naming what a saved search asked for, so a screen can show the answers
 * back before offering to change them. Shared so Home and the results screen can
 * never describe the same search two different ways.
 */
export function describeSearch(answers: QuizAnswers): string {
  const goal = `$${Math.round(answers.target).toLocaleString()} ${TIMEFRAME_WORDS[answers.timeframe]}`;
  const markets = answers.categories
    .map((category) => MARKET_WORDS[category] ?? category.toLowerCase())
    .filter((word, index, all) => all.indexOf(word) === index);
  if (markets.length === 0) return `${goal} · any market`;
  const listed = markets.length > 3
    ? `${markets.length} markets`
    : markets.length === 1
      ? markets[0]
      : `${markets.slice(0, -1).join(', ')} & ${markets[markets.length - 1]}`;
  return `${goal} · ${listed}`;
}

export function buildRouteParams(answers: Omit<QuizAnswers, 'maxRiskLevel' | 'minProbability'>): QuizAnswers {
  const returnPct = answers.balance > 0 ? (answers.target / answers.balance) * 100 : 0;
  const bounds = deriveRiskBounds(answers.timeframe, returnPct);
  const riskTolerance = answers.riskTolerance ?? 'balanced';
  return { ...answers, riskTolerance, ...applyRiskTolerance(bounds, riskTolerance) };
}

export function isLongHorizon(timeframe: QuizAnswers['timeframe']): boolean {
  return LONG_TIMEFRAMES.has(timeframe);
}
