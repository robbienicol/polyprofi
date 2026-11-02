
import { usePortfolioMarketInputs, usePortfolioProgress } from '@/api/hooks/usePortfolioProgress';
import { useTrackedBets } from '@/api/hooks/useTrackedBets';
import { NO_PROGRESS, progressByGoal, type GoalProgress } from '@/lib/goal-progress';
import { realizedPnlFor } from '@/lib/portfolio-progress';
import { betsForGoal } from '@/lib/savings-goal';
import type { SavingsGoal, TrackedBet } from '@/types/bets';

export type { GoalProgress } from '@/lib/goal-progress';

/**
 * Progress for every goal at once, from a single set of market fetches. A list
 * screen can't call a per-goal hook in a loop, so the fan-out happens over data
 * rather than over hooks.
 */
export function useGoalsProgress(goals: SavingsGoal[]) {
  const market = usePortfolioMarketInputs();
  const { allBets, allActive, betsLoading, now, quotes, statusById } = market;

  const byGoalId = progressByGoal(goals, allBets, allActive, statusById, quotes, now);

  const progressFor = (goalId: string | null | undefined): GoalProgress => (goalId ? byGoalId[goalId] ?? NO_PROGRESS : NO_PROGRESS);

  return {
    byGoalId,
    progressFor,
    isLoading: betsLoading,
    isRefreshing: market.isRefreshing,
    refresh: market.refresh,
  };
}

/** The full progress snapshot for one goal — the goal detail screen's numbers. */
export function useGoalProgress(goalId: string | null) {
  const scopeToBets = (bets: TrackedBet[]): TrackedBet[] => (goalId ? betsForGoal(bets, goalId) : []);
  // A goal never claims idle cash, and a scoped snapshot must not write itself
  // into the whole-portfolio history series.
  const progress = usePortfolioProgress(0, { scopeToBets, recordHistory: false });
  const { bets } = useTrackedBets();
  const realized = goalId ? betsForGoal(bets, goalId).reduce((sum, bet) => sum + realizedPnlFor(bet), 0) : 0;
  // Settled wins and losses still count toward the goal after they leave the active list.
  return { ...progress, goalProgress: progress.goalProgress + realized };
}
