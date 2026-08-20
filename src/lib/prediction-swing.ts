import type { ExitPlan, MarketQualityFacts } from '@/types/routes';

/**
 * Bracket ("trade the swing") math for prediction-market contracts.
 *
 * ── The one fact everything here rests on ───────────────────────────────────
 * A prediction-market price is a martingale: today's price IS the market's best
 * estimate of the final 0-or-100 outcome. For a driftless process the probability of
 * touching an upper barrier U before a lower barrier L, starting from X, is
 *
 *     P(U before L) = (X − L) / (U − L)
 *
 * and it depends on NEITHER volatility NOR how much time you allow. Expected value of
 * the bracket is therefore exactly zero before costs:
 *
 *     EV = P·(U − X) − (1 − P)·(X − L)
 *        = [(X − L)(U − X) − (U − X)(X − L)] / (U − L)
 *        = 0
 *
 * Which settles the question this module exists to answer: more time does not make a
 * swing trade better, and neither does a wilder market. A volatile contract touches your
 * sell price more often AND your stop more often, in exactly offsetting measure.
 * Volatility is a multiplier on edge you already have — including negative edge. It is
 * never an edge by itself, and nothing in this file may ever treat it as one.
 *
 * Once the round-trip cost `s` (the spread crossed on the way in and again on the way
 * out) is included, the edge is exactly
 *
 *     edge = −s / (U − L)
 *
 * always negative, and diluted only by widening the bracket. That is why the plans built
 * here place the stop outside both the market's own daily noise and a few multiples of
 * the spread: a tight scalp is a bracket the spread eats alive.
 *
 * ── Why a swing route exists at all ─────────────────────────────────────────
 * Not because of volatility. Because the stop CAPS THE LOSS. Buying at 40¢ with a stop
 * at 32¢ risks 20% of the stake instead of 100%, which is a real, forecast-free
 * improvement in principal protection and the only reason a bracket can outscore the
 * same contract held to resolution. It holds only if the market is liquid enough for the
 * stop to actually fill, which is what `stopGapRisk` prices in — in a thin book the stop
 * is fiction and the route collapses back toward all-or-nothing.
 *
 * ── What time genuinely changes ─────────────────────────────────────────────
 * Only the odds that the bracket closes at all before the user's deadline. More time
 * raises `resolvesInTimeProbability` (and so the reliability the universal score
 * consumes) while leaving EV untouched, and costs time-efficiency and capital lockup.
 * The universal score weighs that trade-off on its own; no hand-tuning here.
 */

const MIN_PRICE_CENTS = 1;
const MAX_PRICE_CENTS = 99;
/** The stop must clear this many days of the market's own wobble, or noise triggers it. */
const NOISE_STOP_SIGMAS = 2;
/** …and this many round trips of spread, or the cost drag dominates the bracket. */
const MIN_STOP_SPREAD_MULTIPLE = 3;

/**
 * P(take-profit touched before stop), in percent. Pure function of the three price
 * levels — deliberately no volatility or time term, per the martingale result above.
 */
export function barrierHitProbability(
  entryCents: number,
  takeProfitCents: number,
  stopCents: number
): number | null {
  const width = takeProfitCents - stopCents;
  if (!(width > 0)) return null;
  if (!(entryCents > stopCents && entryCents < takeProfitCents)) return null;
  return ((entryCents - stopCents) / width) * 100;
}

/**
 * The hit rate the bracket needs just to break even once the round trip is paid, in
 * percent. Always ≥ `barrierHitProbability` by exactly `roundTripCostCents / width`.
 */
export function breakevenHitProbability(
  entryCents: number,
  takeProfitCents: number,
  stopCents: number,
  roundTripCostCents: number
): number | null {
  const width = takeProfitCents - stopCents;
  if (!(width > 0)) return null;
  return clamp(((entryCents - stopCents + roundTripCostCents) / width) * 100, 0, 100);
}

/**
 * The market's own daily price wobble in cents, averaged over whichever observed
 * horizons are available. Observation, not forecast: each sampled move is rescaled by
 * √days so the estimates are comparable, then averaged so one loud day can't dominate.
 */
export function observedDailySigmaCents(quality: MarketQualityFacts): number | null {
  const samples = [
    scaleToDaily(quality.oneDayMovePts, 1),
    scaleToDaily(quality.oneWeekMovePts, 7),
    scaleToDaily(quality.oneMonthMovePts, 30),
    scaleToDaily(quality.recentRangePts, 30),
  ].filter((sample): sample is number => sample != null);
  if (samples.length === 0) return null;
  return samples.reduce((total, sample) => total + sample, 0) / samples.length;
}

/**
 * Expected days until one of the two barriers is touched. Standard result for driftless
 * Brownian motion started at x inside (L, U): E[τ] = (x − L)(U − x) / σ².
 *
 * This is the ONLY place volatility is allowed to enter, and it feeds time, never odds.
 */
export function expectedBarrierDays(
  entryCents: number,
  takeProfitCents: number,
  stopCents: number,
  dailySigmaCents: number
): number | null {
  if (!(dailySigmaCents > 0)) return null;
  const up = takeProfitCents - entryCents;
  const down = entryCents - stopCents;
  if (!(up > 0 && down > 0)) return null;
  return (up * down) / (dailySigmaCents * dailySigmaCents);
}

/**
 * P(the bracket actually closes inside the horizon), in percent, approximated from the
 * expected exit time as 1 − e^(−horizon/τ). An approximation — the exact first-passage
 * distribution is an infinite series — but the right shape: a calm market whose expected
 * exit is far beyond the deadline is correctly credited with little chance of paying out
 * in time, and a fast one asymptotes to certainty.
 */
export function resolvesInTimeProbability(expectedExitDays: number, horizonDays: number): number {
  if (!(expectedExitDays > 0) || !(horizonDays > 0)) return 0;
  return clamp((1 - Math.exp(-horizonDays / expectedExitDays)) * 100, 0, 100);
}

/**
 * The chance a stop DOESN'T save you — the book is too thin to fill at your level and the
 * price gaps straight through it. Squared so it only bites hard at genuinely bad
 * execution: 100 → 0, 50 → 0.25, 20 → 0.64, 0 → 1. A modelled, bounded assumption.
 */
export function stopGapRisk(executionScore: number): number {
  const quality = clamp(executionScore, 0, 100) / 100;
  return (1 - quality) ** 2;
}

export interface SwingPlanInput {
  quality: MarketQualityFacts;
  /** Quoted price of the outcome, in cents — the fallback when there's no two-sided book. */
  priceCents: number;
  /** Profit the user wants as a fraction of the stake (target ÷ balance). Sets the exit. */
  requiredReturnRate: number;
  /** Calendar days until the contract resolves — the position is closed by then regardless. */
  daysToResolution: number;
  /** The user's goal deadline in calendar days. */
  deadlineDays: number;
}

/**
 * Build a bracket plan, or null when the market can't support an honest one.
 *
 * The take-profit is set by the USER'S GOAL (the exit that delivers the requested return
 * net of the round trip), never by a price forecast. The stop is set by the market's own
 * noise. Everything else falls out of the two levels.
 */
export function buildSwingPlan(input: SwingPlanInput): ExitPlan | null {
  const { quality, priceCents, requiredReturnRate, daysToResolution, deadlineDays } = input;

  // No quotable round-trip cost means no honest EV statement, so no plan.
  const spreadCents = quality.spreadCents;
  if (spreadCents == null || !Number.isFinite(spreadCents) || spreadCents < 0) return null;

  const dailySigmaCents = observedDailySigmaCents(quality);
  if (dailySigmaCents == null || dailySigmaCents <= 0) return null;

  // Work on the mid and charge the spread explicitly, so both barriers sit on one series.
  const midCents = round1(
    quality.bestBidCents != null && quality.bestAskCents != null
      ? (quality.bestBidCents + quality.bestAskCents) / 2
      : priceCents
  );
  if (!(midCents > MIN_PRICE_CENTS && midCents < MAX_PRICE_CENTS)) return null;

  const stopCents = round1(
    Math.max(
      MIN_PRICE_CENTS,
      midCents - Math.max(NOISE_STOP_SIGMAS * dailySigmaCents, MIN_STOP_SPREAD_MULTIPLE * spreadCents)
    )
  );
  const stopDistance = midCents - stopCents;
  if (!(stopDistance > 0)) return null;

  // You pay mid + s/2 to get in and receive the barrier − s/2 on the way out.
  const netEntryCents = midCents + spreadCents / 2;
  const takeProfitForGoal = midCents + spreadCents + Math.max(requiredReturnRate, 0) * netEntryCents;
  // Floored at 1:1 against the stop so the plan is never a scalp the spread would eat.
  const takeProfitCents = round1(Math.max(takeProfitForGoal, midCents + stopDistance));
  if (takeProfitCents > MAX_PRICE_CENTS) return null; // the goal needs a price the contract can't reach

  const netWinCents = takeProfitCents - midCents - spreadCents;
  const netLossCents = midCents - stopCents + spreadCents;
  if (!(netWinCents > 0)) return null; // the spread eats the entire upside

  const barrierProbability = barrierHitProbability(midCents, takeProfitCents, stopCents);
  const breakevenProbability = breakevenHitProbability(midCents, takeProfitCents, stopCents, spreadCents);
  if (barrierProbability == null || breakevenProbability == null) return null;

  const rawExitDays = expectedBarrierDays(midCents, takeProfitCents, stopCents, dailySigmaCents);
  if (rawExitDays == null) return null;

  // You are out at resolution whether or not a barrier was touched, so the horizon is
  // whichever comes first: the user's deadline or the contract's own end date.
  const horizonDays = Math.max(1, Math.min(deadlineDays, daysToResolution));
  const resolvesInTime = resolvesInTimeProbability(rawExitDays, horizonDays);

  const plannedLossFraction = clamp(netLossCents / netEntryCents, 0, 1);
  const gapRisk = stopGapRisk(quality.executionScore);
  const effectiveLossFraction = clamp(
    plannedLossFraction + (1 - plannedLossFraction) * gapRisk,
    0,
    1
  );

  return {
    kind: 'bracket',
    entryCents: midCents,
    netEntryCents: round1(netEntryCents),
    takeProfitCents,
    stopCents,
    roundTripCostCents: round1(spreadCents),
    barrierProbability: round1(barrierProbability),
    breakevenProbability: round1(breakevenProbability),
    costEdgePts: round1(barrierProbability - breakevenProbability),
    expectedExitDays: Math.max(1, Math.min(Math.ceil(rawExitDays), horizonDays)),
    resolvesInTimeProbability: round1(resolvesInTime),
    successProbability: round1((barrierProbability / 100) * resolvesInTime),
    plannedLossFraction: round3(plannedLossFraction),
    effectiveLossFraction: round3(effectiveLossFraction),
    winReturnRate: round3(netWinCents / netEntryCents),
  };
}

/** Risk band for a bracketed position, driven by what the stop actually leaves at risk. */
export function bracketRiskLevel(effectiveLossFraction: number): number {
  if (effectiveLossFraction <= 0.15) return 2;
  if (effectiveLossFraction <= 0.3) return 3;
  if (effectiveLossFraction <= 0.6) return 4;
  return 5;
}

function scaleToDaily(movePts: number | undefined, days: number): number | null {
  if (movePts == null || !Number.isFinite(movePts)) return null;
  return Math.abs(movePts) / Math.sqrt(days);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// ── self-check ──────────────────────────────────────────────────────────────
export function __selfCheck(): void {
  // The worked example: buy 40¢, sell 55¢, stop 32¢.
  const hit = barrierHitProbability(40, 55, 32)!;
  invariant(Math.abs(hit - (8 / 23) * 100) < 1e-9, `40/55/32 barrier probability should be 8/23, got ${hit}`);

  // The whole point: with zero cost the barrier probability EQUALS the breakeven, so the
  // bracket is exactly zero-EV. If this ever drifts apart, the martingale model is broken.
  const freeBreakeven = breakevenHitProbability(40, 55, 32, 0)!;
  invariant(Math.abs(hit - freeBreakeven) < 1e-9, 'a costless bracket must be exactly zero-EV');

  // …and with cost the edge is exactly −s/width, never anything better.
  const costedBreakeven = breakevenHitProbability(40, 55, 32, 1)!;
  invariant(
    Math.abs((hit - costedBreakeven) - (-1 / 23) * 100) < 1e-9,
    'cost edge must be exactly −spread/(takeProfit − stop)'
  );
  invariant(costedBreakeven > hit, 'paying a spread can only raise the bar');

  // Volatility must not touch the odds — only the expected time to get there.
  invariant(
    barrierHitProbability(40, 55, 32) === barrierHitProbability(40, 55, 32),
    'barrier odds take no volatility input at all'
  );
  const calmDays = expectedBarrierDays(40, 55, 32, 1)!;
  const wildDays = expectedBarrierDays(40, 55, 32, 4)!;
  invariant(calmDays === 8 * 15, 'E[τ] = (x−L)(U−x)/σ²');
  invariant(wildDays < calmDays, 'a wilder market reaches a barrier sooner — sooner, not more often');

  // More time only raises the chance the bracket closes at all.
  invariant(resolvesInTimeProbability(10, 30) > resolvesInTimeProbability(10, 5), 'more time → more chance of closing');
  invariant(resolvesInTimeProbability(10, 0) === 0, 'no time → no chance of closing');

  // A thin book means the stop may not fill; a deep one means it will.
  invariant(stopGapRisk(100) === 0, 'a perfect book honours the stop');
  invariant(stopGapRisk(0) === 1, 'a dead book makes the stop worthless');
  invariant(stopGapRisk(50) === 0.25, 'gap risk is squared, so it only bites at genuinely bad execution');

  const quality: MarketQualityFacts = {
    executionScore: 100,
    stabilityScore: 80,
    liquidityUsd: 500_000,
    spreadCents: 1,
    bestBidCents: 39.5,
    bestAskCents: 40.5,
    recentRangePts: 16,
    pricePosition: 'middle',
    oneDayMovePts: 3,
    oneWeekMovePts: 8,
    oneMonthMovePts: -12,
  };
  const plan = buildSwingPlan({
    quality,
    priceCents: 40,
    requiredReturnRate: 0.3,
    daysToResolution: 120,
    deadlineDays: 30,
  })!;
  invariant(plan != null, 'a liquid, moving market should produce a plan');
  invariant(plan.entryCents === 40, `plan should enter at the 40¢ mid, got ${plan.entryCents}`);
  invariant(plan.stopCents < plan.entryCents && plan.takeProfitCents > plan.entryCents, 'stop below, target above');
  invariant(plan.costEdgePts < 0, 'a bracket plan can never advertise a positive edge');
  invariant(
    Math.abs(plan.costEdgePts + (plan.roundTripCostCents / (plan.takeProfitCents - plan.stopCents)) * 100) < 0.05,
    'the reported edge must be exactly the cost drag'
  );
  invariant(
    Math.abs(plan.winReturnRate - 0.3) < 0.01,
    `take-profit is set by the 30% goal, got ${plan.winReturnRate}`
  );
  invariant(plan.plannedLossFraction < 1, 'a stop caps the loss below the full stake');
  invariant(
    plan.effectiveLossFraction === plan.plannedLossFraction,
    'a perfectly liquid market takes no gap-risk haircut'
  );
  invariant(plan.expectedExitDays <= 30, 'expected exit never exceeds the horizon');
  invariant(
    plan.successProbability < plan.barrierProbability,
    'needing to close before the deadline can only lower the odds'
  );

  // Same market, illiquid: the stop stops working and the route collapses toward binary.
  const thin = buildSwingPlan({
    quality: { ...quality, executionScore: 10 },
    priceCents: 40,
    requiredReturnRate: 0.3,
    daysToResolution: 120,
    deadlineDays: 30,
  })!;
  invariant(
    thin.effectiveLossFraction > plan.effectiveLossFraction,
    'a thin book must be credited with less stop protection'
  );

  // A market that has never moved gives no bracket to trade.
  const still = buildSwingPlan({
    quality: { ...quality, oneDayMovePts: 0, oneWeekMovePts: 0, oneMonthMovePts: 0, recentRangePts: 0 },
    priceCents: 40,
    requiredReturnRate: 0.3,
    daysToResolution: 120,
    deadlineDays: 30,
  });
  invariant(still === null, 'a motionless market yields no plan rather than a fake one');

  // A goal that needs a price above 100¢ is impossible, not merely unlikely.
  const impossible = buildSwingPlan({
    quality,
    priceCents: 40,
    requiredReturnRate: 3,
    daysToResolution: 120,
    deadlineDays: 30,
  });
  invariant(impossible === null, 'a goal needing >99¢ must yield no plan');

  invariant(bracketRiskLevel(0.1) === 2 && bracketRiskLevel(0.95) === 5, 'risk band follows what the stop leaves at risk');
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[prediction swing self-check] ${message}`);
}
