import { timeframeCalendarDays } from '@/api/client/playbook';
import type { QuizAnswers, TrackedBet } from '@/types/bets';
import type { Route } from '@/types/routes';

/**
 * The tracked position a spending cut becomes. Nothing is staked; the position is
 * worth what the cut saves before the deadline. Shared by the results list and the
 * route detail screen, so a cut taken from either is the same position — before
 * this existed, the detail screen had no cut path at all and saved cuts as $0
 * investments.
 */
export function spendingCutPosition({
  route,
  cut,
  cutPercent,
  timeframe,
  goalId,
  target,
}: {
  route: Route;
  cut: NonNullable<Route['spendingCut']>;
  /** How much of a category the user will give up. Ignored for a subscription. */
  cutPercent: number;
  timeframe: QuizAnswers['timeframe'] | undefined;
  goalId: string | undefined;
  target: number | undefined;
}): TrackedBet {
  const subscription = cut.kind === 'subscription';
  const monthly = subscription ? cut.monthlyAmount : (cut.monthlyAmount * cutPercent) / 100;
  const months = Math.max(1, timeframeCalendarDays(timeframe ?? 'month') / 30);
  const saved = Math.round(monthly * months);
  const openedAt = new Date().toISOString();

  return {
    id: `${route.id}-${Date.now()}`,
    goalId,
    category: route.category,
    emoji: route.emoji,
    description: subscription
      ? `Cancelled ${cut.merchant} — $${cut.monthlyAmount.toFixed(2)}/mo`
      : `Spending ${cutPercent}% less on ${cut.merchant} — $${monthly.toFixed(0)}/mo`,
    platform: route.platform,
    strategy: route.strategy,
    riskLevel: route.riskLevel,
    probability: route.probability,
    expectedReturn: saved,
    amountWagered: 0,
    status: 'active',
    createdAt: openedAt,
    profitGoal: target || saved,
  };
}
