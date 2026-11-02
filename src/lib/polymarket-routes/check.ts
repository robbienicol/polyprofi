import { PolymarketEntry } from '@/api/client/market-data';
import { polymarketMarketQuality } from '@/lib/polymarket-market-quality';
import {
  buildPolymarketRoutes,
  polymarketRiskLevel,
  routesForCandidate,
  toRoute,
  type Candidate,
} from '@/lib/polymarket-routes/build';
import { RouteParams } from '@/types/routes';

export function __selfCheck(): void {
  console.assert(polymarketRiskLevel(90) === 2, '90% contract belongs in the high-confidence band');
  console.assert(polymarketRiskLevel(70) === 3, '70% contract belongs in the balanced-high band');
  console.assert(polymarketRiskLevel(50) === 4, '50% contract is aggressive because the full amount is at risk');
  console.assert(polymarketRiskLevel(20) === 5, '20% contract is a long shot');

  // Relative, not a literal date: a hard-coded end date silently drifts into the past and
  // then every maturity assertion below is really testing the "already expired" floor.
  const inDays = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString();
  const endDate = inDays(180);
  const market: PolymarketEntry = {
    question: 'Will the Lakers beat the Celtics?',
    outcomes: ['Yes', 'No'],
    prices: [0.6, 0.4],
    volumeM: 1,
    slug: 'lakers-beat-celtics',
    endDate,
  };
  const params: RouteParams = {
    balance: 100,
    target: 50,
    timeframe: 'week',
    categories: [],
    riskTolerance: 'balanced',
    maxRiskLevel: 5,
    minProbability: 0,
  };
  const candidate: Candidate = { market, outcomeIndex: 0, outcome: 'Yes', price: 0.6, probability: 60, riskLevel: 3 };
  const route = toRoute(candidate, params, polymarketMarketQuality(market, 0));
  console.assert(route.sourceSlug === market.slug, 'toRoute must preserve the source market slug');
  console.assert(route.sourceEndDate === endDate, 'toRoute must preserve the source market end date');

  // No book and no price history → nothing honest to bracket, so only the hold route.
  console.assert(
    routesForCandidate(candidate, params).length === 1,
    'a market with no quoted spread yields the hold route only, never an invented swing plan',
  );

  // A liquid, moving market yields both ways to play the same contract.
  const tradable: PolymarketEntry = {
    ...market,
    liquidityM: 0.5,
    spread: 0.01,
    bestBid: 0.595,
    bestAsk: 0.605,
    oneDayPriceChange: 0.03,
    oneWeekPriceChange: 0.08,
    oneMonthPriceChange: -0.1,
  };
  console.assert(
    routesForCandidate({ ...candidate, market: tradable }, { ...params, timeframe: 'month' }).length === 1,
    'by default a market is offered as a hold only — a bracket has no edge to sell',
  );
  console.assert(
    route.description.includes('60% chance you get +67%') && route.description.includes('40% chance you lose what you put in'),
    'the hold route says what the price means, in plain words',
  );
  const both = routesForCandidate({ ...candidate, market: tradable }, { ...params, timeframe: 'month' }, { brackets: true });
  console.assert(both.length === 2, 'a liquid, moving market offers both hold and swing routes');
  const [held, swung] = both;
  console.assert(held.lossProfile === 'binary' && swung.lossProfile === 'partial', 'only the bracketed route caps its loss');
  // The label and the risk band are now one decision, so they can never disagree
  // on the same card: "Capital preservation" beside "Very Aggressive" was the bug.
  console.assert(
    both.every((route) => route.lossProfile !== 'partial' || route.riskLevel < 5),
    'no route claims capital preservation while showing the top risk band',
  );
  console.assert(swung.exitPlan?.kind === 'bracket', 'the swing route carries its exit plan');
  console.assert(
    swung.exitPlan!.costEdgePts < 0,
    'a swing route must never advertise a positive edge — the spread is the whole story',
  );
  console.assert(
    swung.maturesInDays! < held.maturesInDays!,
    'the traded position frees capital before the contract resolves',
  );
  console.assert(swung.id !== held.id, 'the two ways to play one contract need distinct ids');

  // The reported bug: a week-long search returned no prediction routes at all,
  // because selection filled its quotas with the highest-volume contracts and the
  // deadline was only applied afterwards. A short-dated market must win a slot
  // over a long-dated one with more volume.
  const longDated: PolymarketEntry = { ...market, question: 'Long-dated', slug: 'long-dated', volumeM: 500, endDate: inDays(180) };
  const shortDated: PolymarketEntry = { ...market, question: 'Short-dated', slug: 'short-dated', volumeM: 1, endDate: inDays(5) };
  const weekPicks = buildPolymarketRoutes([longDated, shortDated], params, 1);
  console.assert(
    weekPicks.some((route) => route.sourceSlug === 'short-dated'),
    'a market resolving inside the deadline outranks a higher-volume one that resolves past it',
  );
  // Preference, not exclusion: with room for both, volume still orders them.
  const bothPicks = buildPolymarketRoutes([longDated, shortDated], params, 8);
  console.assert(
    bothPicks.some((route) => route.sourceSlug === 'long-dated'),
    'a long-dated contract is still offered when there is room — its bracketed swing can still fit',
  );
  // A horizon wide enough for everything must not reshuffle by fit.
  const yearPicks = buildPolymarketRoutes([longDated, shortDated], { ...params, timeframe: '1year' }, 1);
  console.assert(
    yearPicks.every((route) => route.sourceSlug === 'long-dated'),
    'with both inside the horizon the highest-volume market leads again',
  );
}
