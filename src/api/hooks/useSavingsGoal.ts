import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getSavingsGoalState, setSavingsGoalState } from '@/api/client/storage';
import type { SavingsGoalState } from '@/types/bets';

function savingsGoalQueryKey() {
  return ['SAVINGS_GOAL'] as const;
}

const EMPTY_STATE: SavingsGoalState = { current: null, achievedCount: 0 };

export interface SavingsGoalInput {
  label: string;
  emoji: string;
  targetAmount: number;
}

export function useSavingsGoal() {
  const queryClient = useQueryClient();

  const { data, status } = useQuery({
    queryKey: savingsGoalQueryKey(),
    queryFn: getSavingsGoalState,
  });
  const state = data ?? EMPTY_STATE;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: savingsGoalQueryKey() });

  // Set (or replace) the current goal, preserving the lifetime achieved count.
  const { mutate: setGoal } = useMutation({
    mutationFn: async (input: SavingsGoalInput) => {
      const prev = await getSavingsGoalState();
      await setSavingsGoalState({
        current: {
          id: `goal-${Date.now()}`,
          label: input.label.trim(),
          emoji: input.emoji,
          targetAmount: Math.max(1, Math.round(input.targetAmount)),
          createdAt: new Date().toISOString(),
        },
        achievedCount: prev?.achievedCount ?? 0,
      });
    },
    onSettled: invalidate,
  });

  // Mark the current goal reached (idempotent) and bump the lifetime count once.
  const { mutate: markAchieved } = useMutation({
    mutationFn: async () => {
      const prev = await getSavingsGoalState();
      if (!prev?.current || prev.current.achievedAt) return;
      await setSavingsGoalState({
        current: { ...prev.current, achievedAt: new Date().toISOString() },
        achievedCount: prev.achievedCount + 1,
      });
    },
    onSettled: invalidate,
  });

  return {
    goal: state.current,
    achievedCount: state.achievedCount,
    hasGoal: !!state.current,
    isLoading: status === 'pending',
    setGoal,
    markAchieved,
  };
}
