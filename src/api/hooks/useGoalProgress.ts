import { useCallback, useMemo } from 'react';

import { usePortfolioMarketInputs, usePortfolioProgress } from '@/api/hooks/usePortfolioProgress';
import { calculatePortfolioProgress } from '@/lib/portfolio-progress';
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
  const { allActive, betsLoading, now, quotes, statusById } = market;

  const byGoalId = useMemo(() => {
    const entries = goals.map((goal): [string, GoalProgress] => {
      const scoped = betsForGoal(allActive, goal.id);
      if (scoped.length === 0) return [goal.id, NO_PROGRESS];
      const snapshot = calculatePortfolioProgress({
        active: scoped,
        // A goal has no cash of its own; only what is actually staked against it.
        fallbackBalance: 0,
        statusesById: statusById,
        quotes,
        now,
      });
      return [goal.id, {
        netGain: snapshot.goalProgress,
        value: snapshot.value,
        staked: scoped.reduce((sum, bet) => sum + bet.amountWagered, 0),
        activeCount: scoped.length,
      }];
    });
    return Object.fromEntries(entries) as Record<string, GoalProgress>;
  }, [allActive, goals, now, quotes, statusById]);

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
  return usePortfolioProgress(0, { scopeToBets, recordHistory: false });
}
