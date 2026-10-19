import { useState } from "react";

import { useTrackedBets } from "@/api/hooks/useTrackedBets";
import { betOutcomeSide } from "@/lib/bet-monitor-match";
import { parseEntryPrice } from "@/lib/parse-bet-line";
import { openTradeDestination } from "@/lib/route-actions";
import type { TradeDestination, TradeDestinationOptions } from "@/lib/route-actions";
import { spendingCutPosition } from "@/lib/spending-cut-position";
import { rescoreForStake } from "@/lib/stake-rescore";
import { trackedPositionFields } from "@/lib/tracked-assets";
import type { Route, RouteParams } from "@/types/routes";

/** What confirming needs to know about the route on screen. */
interface AcquireContext {
  route: Route;
  stake: number;
  targetProfit: number;
  timeframe: RouteParams["timeframe"] | undefined;
  goalId: string | undefined;
  destination: TradeDestination;
  destinationOptions: TradeDestinationOptions;
}

/**
 * The detail screen's "Add to plan": the form's state, and the position it writes.
 * Called before the screen's early returns, so the confirm step takes the route it
 * acts on rather than closing over it.
 */
export function useRouteDetailAcquire(confirmGoal: (goalId: string) => void) {
  const { trackBet, isTracking } = useTrackedBets();
  const [added, setAdded] = useState(false);
  const [showAcquireForm, setShowAcquireForm] = useState(false);
  const [acquireAmount, setAcquireAmount] = useState("");
  const [cutPercent, setCutPercent] = useState(25);

  function beginAcquire(stake: number): void {
    if (added || isTracking) return;
    setAcquireAmount(String(stake));
    setCutPercent(25);
    setShowAcquireForm(true);
  }

  /** A spending cut stakes nothing: the same position the results list saves. */
  function confirmCut(
    { route, targetProfit, timeframe, goalId }: AcquireContext,
    cut: NonNullable<Route["spendingCut"]>,
  ): void {
    const subscription = cut.kind === "subscription";
    trackBet(
      spendingCutPosition({
        route,
        cut,
        cutPercent,
        timeframe,
        goalId,
        target: targetProfit,
      }),
      {
        onSuccess: () => {
          setAdded(true);
          setShowAcquireForm(false);
          if (goalId) confirmGoal(goalId);
          if (subscription) void openTradeDestination(route, "cancel");
        },
      },
    );
  }

  function confirmAcquire(context: AcquireContext): void {
    const { route, stake, targetProfit, goalId, destination, destinationOptions } = context;
    if (added || isTracking) return;
    if (route.spendingCut) {
      confirmCut(context, route.spendingCut);
      return;
    }
    // A card-rewards plan stakes nothing; its value is the rewards themselves.
    const amount = route.cardRewards ? 0 : Number(acquireAmount);
    if (!route.cardRewards && (!Number.isFinite(amount) || amount <= 0)) return;
    const predictionMarket = /polymarket|prediction/i.test(
      `${route.category} ${route.platform}`,
    );
    // The exact price first — the line is rounded to the cent, and the position would
    // otherwise track its P&L against a contract it never bought.
    const entryPrice =
      route.entryPrice ??
      parseEntryPrice(route.line) ??
      (predictionMarket && route.probability > 0
        ? route.probability / 100
        : undefined);
    const openedAt = new Date().toISOString();
    // The card is priced at `stake`; the form may have been edited to another
    // amount, and the position must store the return for what was actually put in.
    const [atAmount = route] = rescoreForStake([route], stake || 1, amount, targetProfit);
    trackBet(
      {
        // Derived from openedAt rather than a second clock read, so the id and the
        // recorded open time can never disagree.
        id: `${route.id}-${new Date(openedAt).getTime()}`,
        // The goal comes from the saved search that produced this route, so a
        // position opened from a deep link days later still lands on the right one.
        goalId,
        category: route.category,
        emoji: route.emoji,
        description: atAmount.description,
        platform: route.platform,
        strategy: route.strategy,
        riskLevel: route.riskLevel,
        probability: route.probability,
        expectedReturn: atAmount.expectedReturn,
        amountWagered: amount,
        status: "active",
        createdAt: openedAt,
        profitGoal: targetProfit,
        line: route.line,
        entryPrice,
        monitorQuery: `${route.description} ${route.line ?? ""}`,
        sourceSlug: route.sourceSlug,
        outcomeSide: betOutcomeSide(route) ?? undefined,
        ...trackedPositionFields(route, amount, openedAt),
      },
      {
        onSuccess: () => {
          setAdded(true);
          setShowAcquireForm(false);
          // Acquiring is the commitment that turns a searched-for goal into a real one.
          if (goalId) confirmGoal(goalId);
          void openTradeDestination(route, destination, destinationOptions);
        },
      },
    );
  }

  return {
    added,
    isTracking,
    showAcquireForm,
    setShowAcquireForm,
    acquireAmount,
    setAcquireAmount,
    cutPercent,
    setCutPercent,
    beginAcquire,
    confirmAcquire,
  };
}
