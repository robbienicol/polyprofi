import { useRef, useState } from 'react';

import { useTrackedBets } from '@/api/hooks/useTrackedBets';
import { cutActionLabel, stampedId } from '@/components/routes/routes-screen/routes-screen-helpers';
import type { Receipt } from '@/components/routes/routes-screen/TrackReceipt';
import { requestAppRating } from '@/lib/app-rating';
import { betOutcomeSide } from '@/lib/bet-monitor-match';
import { parseEntryPrice } from '@/lib/parse-bet-line';
import { openTradeDestination, preferredTradeDestination, tradeDestinationLabel } from '@/lib/route-actions';
import type { buildRouteResults } from '@/lib/route-results';
import { spendingCutPosition } from '@/lib/spending-cut-position';
import { rescoreForStake } from '@/lib/stake-rescore';
import { trackedPositionFields } from '@/lib/tracked-assets';
import type { Route, RouteParams } from '@/types/routes';

/**
 * Adding a route from the list: which card's form is open, what it says, and the
 * position each kind of route writes — a cut, a card-rewards plan, or a stake.
 */
export function useRouteAcquire({ sessionParams, sessionGoalId, confirmGoal, results, referenceStake }: {
  sessionParams: RouteParams | null;
  sessionGoalId: string | undefined;
  confirmGoal: (goalId: string) => void;
  results: ReturnType<typeof buildRouteResults> | null;
  referenceStake: number;
}) {
  const { trackBet, isTracking: isTrackingBet } = useTrackedBets();
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [trackingAmount, setTrackingAmount] = useState('');
  // What was just written, held until the user has read it. Nothing opens a trading
  // venue on its own any more: the app takes an action, says what it recorded, and
  // then offers the handoff as a separate tap.
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  // How much of a category the user says they will actually give up. Defaults to the
  // same share the card was priced at, so confirming without touching it is a no-op.
  const [cutPercent, setCutPercent] = useState(25);

  // Asked after a route has actually been added — the one moment the app has done
  // something for this user — and never during the wait before it has answered a
  // single question. Guarded so it fires once per session rather than per receipt.
  const ratedThisSession = useRef(false);

  /** Opens the acquire form under a card, prefilled with the stake the card is priced at. */
  function startTracking(route: Route): void {
    setTrackingId(route.id);
    setCutPercent(25);
    setTrackingAmount(String(results?.selectedStake(route) ?? referenceStake));
  }

  /**
   * Hands the user the receipt for what was just written, and asks for a rating once
   * the app has finally done something worth rating. Nothing navigates away on its
   * own: `onAction` is a button they choose, not a side effect of confirming.
   */
  function showReceipt(next: Receipt): void {
    setReceipt(next);
    if (!ratedThisSession.current) {
      ratedThisSession.current = true;
      void requestAppRating();
    }
  }

  /**
   * Taking a cut, which is not an acquisition: nothing is staked, so `amountWagered`
   * is 0 and the position's value is the saving itself. A subscription is cancelled
   * once and worth its whole charge; a category is worth whatever share of it the
   * user just committed to, which is why the stored return is rescaled here rather
   * than copied off the card.
   */
  function confirmCut(route: Route, cut: NonNullable<Route['spendingCut']>): void {
    const subscription = cut.kind === 'subscription';
    trackBet(spendingCutPosition({
      route,
      cut,
      cutPercent,
      timeframe: sessionParams?.timeframe,
      goalId: sessionGoalId,
      target: sessionParams?.target,
    }), {
      onSuccess: () => {
        setTrackingId(null);
        setCutPercent(25);
        if (sessionGoalId) confirmGoal(sessionGoalId);
        // Only a subscription has somewhere to go. Cutting back on a category is a
        // promise to yourself, and opening a page for it would be theatre.
        showReceipt({
          routeId: route.id,
          lines: [
            [subscription ? 'Cancelling' : 'Cutting back on', route.description],
            ['Counts toward', `+$${(sessionParams?.target ?? 0).toLocaleString()}`],
            ['Staked', 'Nothing — this is money you keep'],
          ],
          actionLabel: subscription ? cutActionLabel(route) : null,
          onAction: subscription ? () => { void openTradeDestination(route, 'cancel'); } : null,
        });
      },
    });
  }

  /**
   * Taking a card-rewards route. Nothing is staked; the position is worth the rewards
   * the plan is expected to earn before the deadline, the same way a cut is worth
   * its saving. A new card opens its application once it is in the plan.
   */
  function confirmCardRewards(route: Route, plan: NonNullable<Route['cardRewards']>): void {
    trackBet({
      id: stampedId(route.id),
      goalId: sessionGoalId,
      category: route.category,
      emoji: route.emoji,
      description: route.description,
      platform: route.platform,
      strategy: route.strategy,
      riskLevel: route.riskLevel,
      probability: route.probability,
      expectedReturn: route.expectedReturn,
      amountWagered: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
      profitGoal: sessionParams?.target || route.expectedReturn,
    }, {
      onSuccess: () => {
        setTrackingId(null);
        if (sessionGoalId) confirmGoal(sessionGoalId);
        showReceipt({
          routeId: route.id,
          lines: [
            ['Added to your plan', route.description],
            ['Expected to earn', `+$${route.expectedReturn.toLocaleString()} by your deadline`],
            ['Staked', 'Nothing — these are rewards on spending you already do'],
          ],
          actionLabel: plan.kind === 'new-card' ? 'Open the application' : null,
          onAction: plan.kind === 'new-card' ? () => { void openTradeDestination(route, 'apply'); } : null,
        });
      },
    });
  }

  function confirmAcquire(route: Route): void {
    if (route.spendingCut) {
      confirmCut(route, route.spendingCut);
      return;
    }
    if (route.cardRewards) {
      confirmCardRewards(route, route.cardRewards);
      return;
    }
    const amount = Number(trackingAmount);
    if (!Number.isFinite(amount) || amount <= 0 || isTrackingBet) return;
    const predictionMarket = /polymarket|prediction/i.test(`${route.category} ${route.platform}`);
    // The route's own exact price first: the line is rounded to the cent, and a position
    // opened at "98¢" prices its own P&L against a contract it never bought.
    const entryPrice = route.entryPrice
      ?? parseEntryPrice(route.line)
      ?? (predictionMarket && route.probability > 0 ? route.probability / 100 : undefined);
    const destination = preferredTradeDestination(route, sessionParams?.preferredPlatforms);
    const openedAt = new Date().toISOString();
    // The card's figures belong to the slider's stake. The acquire form is only
    // prefilled from it, so an edited amount would otherwise store a payout for a
    // stake the user never took — inflating this position's return, the portfolio's
    // expected profit, and its weighted return.
    // The listed route is already priced at its own stake, so that is the base the
    // edited amount scales from — not the search's reference stake.
    const listedStake = results?.selectedStake(route) ?? referenceStake;
    const [atAmount = route] = rescoreForStake([route], listedStake, amount, sessionParams?.target ?? 0);
    trackBet({
      id: stampedId(route.id),
      // The position works toward the goal this search was run for.
      goalId: sessionGoalId,
      category: route.category,
      emoji: route.emoji,
      description: atAmount.description,
      platform: route.platform,
      strategy: route.strategy,
      riskLevel: route.riskLevel,
      probability: route.probability,
      expectedReturn: atAmount.expectedReturn,
      amountWagered: amount,
      status: 'active',
      createdAt: openedAt,
      profitGoal: sessionParams?.target || atAmount.expectedReturn,
      line: route.line,
      entryPrice,
      monitorQuery: `${route.description} ${route.line ?? ''}`,
      sourceSlug: route.sourceSlug,
      outcomeSide: betOutcomeSide(route) ?? undefined,
      ...trackedPositionFields(route, amount, openedAt),
    }, {
      onSuccess: () => {
        setTrackingId(null);
        // Acquiring is the commitment: this is where a searched-for goal becomes a
        // goal the user actually has, and joins the Goals tab.
        if (sessionGoalId) confirmGoal(sessionGoalId);
        showReceipt({
          routeId: route.id,
          lines: [
            ['Added to your plan', atAmount.description],
            ['Staking', `$${amount.toLocaleString()}${route.line ? ` at ${route.line}` : ''}`],
            ['If it works', `+$${Math.round(atAmount.expectedReturn).toLocaleString()}`],
            ['If it does not', route.lossProfile === 'binary' ? `You lose the $${amount.toLocaleString()}. There is no middle outcome.` : 'You keep what the position is worth at the time.'],
          ],
          actionLabel: `Open ${tradeDestinationLabel(destination)}`,
          onAction: () => { void openTradeDestination(route, destination); },
        });
      },
    });
  }

  return {
    trackingId,
    setTrackingId,
    trackingAmount,
    setTrackingAmount,
    receipt,
    setReceipt,
    cutPercent,
    setCutPercent,
    startTracking,
    confirmAcquire,
  };
}
