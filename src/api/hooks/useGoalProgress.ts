import { useCallback, useMemo } from 'react';

import { usePortfolioMarketInputs, usePortfolioProgress } from '@/api/hooks/usePortfolioProgress';
import { useTrackedBets } from '@/api/hooks/useTrackedBets';
import { calculatePortfolioProgress, realizedPnlFor } from '@/lib/portfolio-progress';
import { betsForGoal } from '@/lib/savings-goal';
import type { SavingsGoal, TrackedBet } from '@/types/bets';

export interface GoalProgress {
  /** Net gains attributable to this goal — the only thing that counts toward a target. */
  netGain: number;
  /** Current value of the goal's positions, principal included. */
  value: number;
  /** Principal staked against this goal. */
  staked: number;
  activeCount: number;
}

const NO_PROGRESS: GoalProgress = { netGain: 0, value: 0, staked: 0, activeCount: 0 };

/**
 * Progress for every goal at once, from a single set of market fetches. A list
 * screen can't call a per-goal hook in a loop, so the fan-out happens over data
 * rather than over hooks.
 */
export function useGoalsProgress(goals: SavingsGoal[]) {
  const market = usePortfolioMarketInputs();
  const { allBets, allActive, betsLoading, now, quotes, statusById } = market;

  const byGoalId = useMemo(() => {
    const entries = goals.map((goal): [string, GoalProgress] => {
      const scoped = betsForGoal(allActive, goal.id);
      const realized = betsForGoal(allBets, goal.id).reduce((sum, bet) => sum + realizedPnlFor(bet), 0);
      if (scoped.length === 0) return [goal.id, realized === 0 ? NO_PROGRESS : { ...NO_PROGRESS, netGain: realized }];
      const snapshot = calculatePortfolioProgress({
        active: scoped,
        // A goal has no cash of its own; only what is actually staked against it.
        fallbackBalance: 0,
        statusesById: statusById,
        quotes,
        now,
      });
      return [goal.id, {
        netGain: snapshot.goalProgress + realized,
        value: snapshot.value,
        staked: scoped.reduce((sum, bet) => sum + bet.amountWagered, 0),
        activeCount: scoped.length,
      }];
    });
    return Object.fromEntries(entries) as Record<string, GoalProgress>;
  }, [allBets, allActive, goals, now, quotes, statusById]);

  const progressFor = useCallback(
    (goalId: string | null | undefined): GoalProgress => (goalId ? byGoalId[goalId] ?? NO_PROGRESS : NO_PROGRESS),
    [byGoalId],
  );

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
  const scopeToBets = useCallback(
    (bets: TrackedBet[]): TrackedBet[] => (goalId ? betsForGoal(bets, goalId) : []),
    [goalId],
  );
  // A goal never claims idle cash, and a scoped snapshot must not write itself
  // into the whole-portfolio history series.
  const progress = usePortfolioProgress(0, { scopeToBets, recordHistory: false });
  const { bets } = useTrackedBets();
  const realized = useMemo(
    () => (goalId ? betsForGoal(bets, goalId).reduce((sum, bet) => sum + realizedPnlFor(bet), 0) : 0),
    [bets, goalId],
  );
  // Settled wins and losses still count toward the goal after they leave the active list.
  return { ...progress, goalProgress: progress.goalProgress + realized };
}
