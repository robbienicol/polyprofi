import { timeframeCalendarDays } from "@/api/client/playbook";
import type { useMarketComparison } from "@/api/hooks/useMarketComparison";
import { cancellationActionLabel, cancellationTargetFor } from "@/lib/cancel-links";
import { preferredTradeDestination, tradeVenuesForRoute } from "@/lib/route-actions";
import { primaryCalibration, routeCalibrations } from "@/lib/route-calibration";
import { goalEffectivenessScore, type ScoreWeights } from "@/lib/score";
import { rescoreForStake, stakeNeededForReturn } from "@/lib/stake-rescore";
import type { Route, SavedRoutesBatch } from "@/types/routes";

type MarketComparison = ReturnType<typeof useMarketComparison>["comparison"];

/** A `?stake=` / `?available=` param as a positive whole number, or null when absent or junk. */
function positiveParam(value: string | undefined): number | null {
  const requested = Number(value);
  return Number.isFinite(requested) && requested > 0 ? Math.round(requested) : null;
}

/**
 * Everything the detail screen shows, derived from the saved route, the search it
 * came from and the stake the list handed over. Pure: the screen renders it.
 */
export function routeDetailModel({
  savedRoute,
  batch,
  stakeParam,
  availableParam,
  scoreWeights,
  comparison,
}: {
  savedRoute: Route;
  batch: SavedRoutesBatch | undefined;
  stakeParam: string | undefined;
  availableParam: string | undefined;
  scoreWeights: ScoreWeights;
  comparison: MarketComparison;
}) {
  const baseStake = batch?.quizSnapshot.balance ?? 0;
  const targetProfit = batch?.quizSnapshot.target ?? savedRoute.expectedReturn;
  // The goal deadline of the search this route came from, so a debt maturity can be
  // compared against the date the user actually needs the money.
  const goalDeadlineDays = batch
    ? timeframeCalendarDays(batch.quizSnapshot.timeframe)
    : null;
  const defaultStake = Math.min(
    baseStake || 1,
    stakeNeededForReturn(savedRoute, baseStake || 1, targetProfit) ??
      (baseStake || 1),
  );
  const stake = positiveParam(stakeParam) ?? defaultStake;
  const availableInvestment = positiveParam(availableParam) ?? (baseStake || stake);
  const route = rescoreForStake(
    [savedRoute],
    baseStake || stake || 1,
    stake || baseStake || 1,
    targetProfit,
  )[0];
  const neededToHitGoal = stakeNeededForReturn(
    savedRoute,
    baseStake || stake || 1,
    targetProfit,
  );
  // Scored with the user's own weights, so the breakdown below explains this number
  // the way they asked for it rather than the way the app used to insist on.
  const scoreBreakdown = goalEffectivenessScore(
    route,
    {
      target: targetProfit,
      requiredInvestment: neededToHitGoal,
      availableInvestment,
      deadlineDays: goalDeadlineDays ?? route.maturesInDays ?? 1,
    },
    scoreWeights,
  );
  const relatedRoutes = (batch?.routes ?? [])
    .filter((candidate) => candidate.id !== route.id)
    .sort(
      (a, b) =>
        Number(b.category === route.category) -
          Number(a.category === route.category) ||
        Math.abs(a.probability - route.probability) -
          Math.abs(b.probability - route.probability),
    )
    .slice(0, 3);

  const destination = preferredTradeDestination(
    route,
    batch?.quizSnapshot.preferredPlatforms,
  );
  const destinationOptions = {
    kalshiEventTicker: comparison?.kalshiEventTicker,
    kalshiSeriesTicker: comparison?.kalshiSeriesTicker,
  };
  // One entry for most routes; two when the same contract is listed on Kalshi as well,
  // cheapest first.
  const venues = tradeVenuesForRoute(
    route,
    batch?.quizSnapshot.preferredPlatforms,
    comparison,
  );

  // How markets priced like this one have actually resolved. Empty for anything that
  // is not a prediction market, and for a pick whose cohort is too thin to report —
  // both ordinary, and both mean the card simply does not appear.
  const calibrations = routeCalibrations(route, comparison);
  const primaryTrackRecord = primaryCalibration(calibrations, destination);

  // A subscription cut's button says what the link will actually do — cancel, or
  // search for how to — never a trade venue.
  const cutActionLabel =
    route.spendingCut?.kind === "subscription"
      ? cancellationActionLabel(
          cancellationTargetFor(route.spendingCut.merchant),
          route.spendingCut.merchant,
        )
      : null;

  return {
    baseStake,
    targetProfit,
    goalDeadlineDays,
    stake,
    availableInvestment,
    route,
    neededToHitGoal,
    scoreBreakdown,
    relatedRoutes,
    destination,
    destinationOptions,
    venues,
    calibrations,
    primaryTrackRecord,
    cutActionLabel,
  };
}

/** The stake a related route opens at: what it needs for the goal, capped by what is available. */
export function relatedRouteStake(
  selected: Route,
  baseStake: number,
  targetProfit: number,
  availableInvestment: number,
): number {
  return Math.min(
    availableInvestment,
    stakeNeededForReturn(
      selected,
      baseStake || 1,
      targetProfit,
    ) ?? availableInvestment,
  );
}
