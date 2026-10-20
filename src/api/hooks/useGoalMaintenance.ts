import { useEffect, useRef } from 'react';

import { useGoalsProgress } from '@/api/hooks/useGoalProgress';
import { useSavingsGoal } from '@/api/hooks/useSavingsGoal';
import { useTrackedBets } from '@/api/hooks/useTrackedBets';
import { hasReachedProfitGoal } from '@/lib/portfolio-progress';
import { abandonedDraftGoalIds, isOpenEnded } from '@/lib/savings-goal';

/**
 * Goal bookkeeping that belongs to no single screen:
 *
 *  - marks a goal reached once its own positions have earned its target
 *  - sweeps away draft goals whose deadline passed with nothing attached
 *
 * Mounted once at the root, so a goal completes whether or not the user happens
 * to be looking at the screen that used to own the check.
 */
export function useGoalMaintenance(): void {
  const { allGoals, isLoading, markAchieved, removeGoal } = useSavingsGoal();
  const { bets, isLoading: betsLoading } = useTrackedBets();
  const progress = useGoalsProgress(allGoals);
  // Both actions are one-shot writes: only ever attempt a given goal once per
  // session, so a re-render mid-mutation can't fire them twice.
  const claimed = useRef<Set<string>>(new Set());
  const swept = useRef<Set<string>>(new Set());

  // Principal never counts toward a target — only net gains on the goal's own
  // positions can complete it. An open-ended goal has no target to complete.
  useEffect(() => {
    if (isLoading) return;
    for (const goal of allGoals) {
      if (goal.achievedAt || isOpenEnded(goal) || claimed.current.has(goal.id)) continue;
      if (!hasReachedProfitGoal(progress.progressFor(goal.id).netGain, goal.targetAmount as number)) continue;
      claimed.current.add(goal.id);
      markAchieved(goal.id);
    }
  }, [allGoals, isLoading, markAchieved, progress]);

  useEffect(() => {
    if (isLoading || betsLoading) return;
    for (const goalId of abandonedDraftGoalIds(allGoals, bets, Date.now())) {
      if (swept.current.has(goalId)) continue;
      swept.current.add(goalId);
      removeGoal(goalId);
    }
  }, [allGoals, bets, betsLoading, isLoading, removeGoal]);
}
