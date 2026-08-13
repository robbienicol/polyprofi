import { PolymarketEntry } from '@/api/client/market-data';
import { polymarketMarketQuality } from '@/lib/polymarket-market-quality';
import { bracketRiskLevel, buildSwingPlan } from '@/lib/prediction-swing';
import { ExitPlan, MarketQualityFacts, Route, RouteParams } from '@/types/routes';

type RiskBand = 2 | 3 | 4 | 5;

interface Candidate {
  market: PolymarketEntry;
  outcomeIndex: number;
  outcome: string;
  price: number;
  probability: number;
  riskLevel: RiskBand;
}

function polymarketRiskLevel(probability: number): RiskBand {
  if (probability >= 85) return 2;
  if (probability >= 65) return 3;
  if (probability >= 35) return 4;
  return 5;
}

function fallbackMaturity(timeframe: string): number {
  return ({ today: 1, week: 7, month: 30, '3months': 90, '1year': 365, '5years': 1825 } as Record<string, number>)[timeframe] ?? 30;
}

function maturityDays(endDate: string | undefined, timeframe: string): number {
  if (!endDate) return fallbackMaturity(timeframe);
  const end = new Date(endDate).getTime();
  if (!Number.isFinite(end)) return fallbackMaturity(timeframe);
  return Math.max(1, Math.ceil((end - Date.now()) / 86_400_000));
}

function stableId(market: PolymarketEntry, outcome: string): string {
  const base = market.slug || market.question;
  const safe = `${base}-${outcome}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `pm-live-${safe.slice(0, 90)}`;
}

function toRoute(candidate: Candidate, params: RouteParams, quality: MarketQualityFacts): Route {
  const { market, outcome, price, probability, riskLevel } = candidate;
  const expectedReturn = Math.round(params.balance * (1 / price - 1));
  const cents = Math.round(price * 100);
  const volume = market.volumeM >= 1
    ? `$${market.volumeM.toFixed(1)}M`
    : `$${Math.round(market.volumeM * 1000).toLocaleString()}K`;

  return {
    id: stableId(market, outcome),
    category: 'Polymarket',
    emoji: '🔮',
    description: `Buy ${outcome} on “${market.question}” at ${cents}¢ — ${probability}% market-implied chance, ${volume} traded.`,
    riskLevel,
    probability,
    expectedReturn,
    platform: 'Polymarket',
    line: `${outcome} ${cents}¢`,
    maturesInDays: maturityDays(market.endDate, params.timeframe),
    lossProfile: 'binary',
    meetsTarget: expectedReturn >= params.target,
    strategy: `Buy ${outcome} near ${cents}¢ and hold to resolution. Maximum loss is the full $${Math.round(params.balance).toLocaleString()} stake. No independent edge is assumed; this score uses the live market price and loss profile.`,
    marketQuality: quality,
    sourceSlug: market.slug,
    sourceEndDate: market.endDate,
  };
}

/**
 * The same contract offered as a *traded* position instead of a held one: buy, then exit
 * at a pre-committed take-profit or stop rather than waiting for resolution.
 *
 * Read the header of @/lib/prediction-swing before touching the copy here. A bracket on a
 * market-priced contract is exactly zero-EV before costs and strictly negative after, so
 * this route is never presented as a way to profit from volatility. It exists because the
 * stop caps the loss, and because it frees the capital long before a contract that
 * resolves after the user's deadline ever could. Both of those are facts, not forecasts.
 */
function toSwingRoute(
  candidate: Candidate,
  params: RouteParams,
  quality: MarketQualityFacts,
  plan: ExitPlan
): Route {
  const { market, outcome } = candidate;
  const expectedReturn = Math.round(params.balance * plan.winReturnRate);
  const riskLevel = bracketRiskLevel(plan.effectiveLossFraction);
  const maxLossPct = Math.round(plan.effectiveLossFraction * 100);
  const stake = Math.round(params.balance).toLocaleString();

  return {
    id: `${stableId(market, outcome)}-swing`,
    category: 'Polymarket',
    emoji: '🔁',
    description:
      `Trade ${outcome} on “${market.question}”: buy near ${plan.entryCents}¢, sell at ` +
      `${plan.takeProfitCents}¢, stop at ${plan.stopCents}¢ — the stop caps the loss at about ` +
      `${maxLossPct}% of your stake instead of all of it.`,
    riskLevel,
    probability: Math.round(plan.successProbability),
    expectedReturn,
    platform: 'Polymarket',
    line: `${outcome} ${plan.entryCents}¢ → ${plan.takeProfitCents}¢`,
    maturesInDays: plan.expectedExitDays,
    lossProfile: 'partial',
    meetsTarget: expectedReturn >= params.target,
    strategy:
      `Buy ${outcome} near ${plan.entryCents}¢ (about ${plan.netEntryCents}¢ after the spread), ` +
      `sell at ${plan.takeProfitCents}¢, stop out at ${plan.stopCents}¢. ` +
      `${plan.barrierProbability}% of the time ${plan.takeProfitCents}¢ comes before ${plan.stopCents}¢ — but ` +
      `you need ${plan.breakevenProbability}% just to break even, so the ${plan.roundTripCostCents}¢ round-trip ` +
      `spread is a ${Math.abs(plan.costEdgePts).toFixed(1)}-point drag and there is no edge here without a view ` +
      `the market is wrong. What the plan does buy you: the stop caps the loss near ` +
      `$${Math.round(params.balance * plan.effectiveLossFraction).toLocaleString()} of your $${stake} ` +
      `instead of all of it, and the position typically closes in about ${plan.expectedExitDays}d rather ` +
      `than waiting for the contract to resolve.`,
    marketQuality: quality,
    exitPlan: plan,
    sourceSlug: market.slug,
    sourceEndDate: market.endDate,
  };
}

/** The hold route, plus the traded variant of the same contract when one is honest to build. */
function routesForCandidate(candidate: Candidate, params: RouteParams): Route[] {
  const quality = polymarketMarketQuality(candidate.market, candidate.outcomeIndex);
  const hold = toRoute(candidate, params, quality);
  const plan = buildSwingPlan({
    quality,
    priceCents: candidate.price * 100,
    requiredReturnRate: params.balance > 0 ? params.target / params.balance : 0,
    daysToResolution: maturityDays(candidate.market.endDate, params.timeframe),
    deadlineDays: fallbackMaturity(params.timeframe),
  });
  return plan == null ? [hold] : [hold, toSwingRoute(candidate, params, quality, plan)];
}

/**
 * Turn the live market universe into a balanced exploration pool. Each market
 * appears once, and quotas keep high-confidence, balanced, and long-shot
 * contracts represented instead of letting one price band dominate by volume.
 *
 * `limit` counts MARKETS, not routes: a market with a two-sided book and some recent
 * movement contributes both a hold-to-resolution route and a traded (bracketed) one.
 */
export function buildPolymarketRoutes(
  markets: PolymarketEntry[],
  params: RouteParams,
  limit = 120
): Route[] {
  const candidates: Candidate[] = markets.flatMap((market) =>
    market.prices.map((price, index) => {
      const probability = Math.round(price * 100);
      return {
        market,
        outcomeIndex: index,
        outcome: market.outcomes[index] ?? (index === 0 ? 'Yes' : 'No'),
        price,
        probability,
        riskLevel: polymarketRiskLevel(probability),
      };
    })
  );

  const bands: RiskBand[] = [2, 3, 4, 5];
  const baseQuota = Math.floor(limit / bands.length);
  const usedMarkets = new Set<string>();
  const selected: Candidate[] = [];

  for (const [index, band] of bands.entries()) {
    const quota = baseQuota + (index < limit % bands.length ? 1 : 0);
    const choices = candidates
      .filter((candidate) => candidate.riskLevel === band)
      .sort((a, b) => b.market.volumeM - a.market.volumeM || b.probability - a.probability);

    for (const candidate of choices) {
      if (selected.filter((item) => item.riskLevel === band).length >= quota) break;
      if (usedMarkets.has(candidate.market.question)) continue;
      selected.push(candidate);
      usedMarkets.add(candidate.market.question);
    }
  }

  if (selected.length < limit) {
    const remaining = [...candidates].sort((a, b) => b.market.volumeM - a.market.volumeM);
    for (const candidate of remaining) {
      if (selected.length >= limit) break;
      if (usedMarkets.has(candidate.market.question)) continue;
      selected.push(candidate);
      usedMarkets.add(candidate.market.question);
    }
  }

  return selected.flatMap((candidate) => routesForCandidate(candidate, params));
}

export function __selfCheck(): void {
  console.assert(polymarketRiskLevel(90) === 2, '90% contract belongs in the high-confidence band');
  console.assert(polymarketRiskLevel(70) === 3, '70% contract belongs in the balanced-high band');
  console.assert(polymarketRiskLevel(50) === 4, '50% contract is aggressive because the full stake is at risk');
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
  const both = routesForCandidate({ ...candidate, market: tradable }, { ...params, timeframe: 'month' });
  console.assert(both.length === 2, 'a liquid, moving market offers both hold and swing routes');
  const [held, swung] = both;
  console.assert(held.lossProfile === 'binary' && swung.lossProfile === 'partial', 'only the bracketed route caps its loss');
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
}
