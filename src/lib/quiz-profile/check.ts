import { filterRoutesForQuiz, sortSafestFirst } from '@/lib/quiz-profile/filter';
import {
  deriveRiskBounds,
  enforceRouteIntegrity,
  investmentSliderMaximum,
  referenceStakeFor,
  surveyAmountCeiling,
} from '@/lib/quiz-profile/params';
import { Route, RouteParams } from '@/types/routes';

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
    referenceStakeFor(100, surveyAmountCeiling('$5,000 - $25,000')) === 5_000,
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

  // the reported bug: every asset class ticked, only prediction markets on screen.
  const strictParams: RouteParams = { ...weekParams, maxRiskLevel: 4, minProbability: 55 };
  const etfLowOdds: Route = {
    ...voo, id: 'etf-low-odds', category: 'Stocks & ETFs', lossProfile: 'partial', probability: 6,
  };
  const contract: Route = {
    ...voo, id: 'contract', category: 'Polymarket', lossProfile: 'binary', probability: 80,
  };
  const longshotContract: Route = {
    ...voo, id: 'longshot-contract', category: 'Polymarket', lossProfile: 'binary', probability: 20,
  };
  const kept = filterRoutesForQuiz([etfLowOdds, contract, longshotContract], strictParams);
  console.assert(
    kept.some((route) => route.id === 'etf-low-odds'),
    "a capital-preserving route is not held to the binary contract's probability floor — that floor is why the feed was all prediction markets",
  );
  console.assert(
    kept.every((route) => route.id !== 'longshot-contract'),
    'the probability floor still applies to all-or-nothing contracts, where it means "your stake is probably gone"',
  );

  // crypto is riskLevel 5 across the board, so any cap below that deleted the answer
  const coin: Route = { ...voo, id: 'coin', category: 'Crypto', riskLevel: 5, probability: 8, lossProfile: 'partial' };
  const cappedOut = filterRoutesForQuiz([coin, contract], { ...strictParams, categories: ['Crypto', 'Polymarket'] });
  console.assert(
    cappedOut.some((route) => route.id === 'coin'),
    'a class the user explicitly ticked never comes back empty, even when the risk cap excludes every route in it',
  );

  // an onboarding exclusion must not override what they just ticked in the quiz
  const overridden = filterRoutesForQuiz(
    [cryptoRoute],
    { ...weekParams, categories: ['Crypto'], excludedCategories: ['Crypto'] },
  );
  console.assert(
    overridden.length === 1,
    'ticking a market in the quiz beats the same market being avoided in onboarding — the later, explicit answer wins',
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
