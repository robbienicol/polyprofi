import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getSavingsGoalState, setSavingsGoalState } from '@/api/client/storage';
import { apiBaseUrl } from '@/lib/api-base-url';
import { isRecord, isSavingsGoalState, responseJson } from '@/lib/runtime-validation';
import { notifyGoalAchieved } from '@/lib/notifications';
import {
  GOAL_ACCOUNTING_VERSION,
  migrateSavingsGoalState,
  pendingCelebrationGoal,
} from '@/lib/savings-goal';
import type { SavingsGoalState } from '@/types/bets';

function savingsGoalQueryKey(userId: string | null | undefined) {
  return ['SAVINGS_GOAL', userId ?? 'local'] as const;
}

function parseSavingsGoalPayload(value: unknown): SavingsGoalState | null {
  if (!isRecord(value)) return null;
  return value.savingsGoalState === null || isSavingsGoalState(value.savingsGoalState)
    ? value.savingsGoalState
    : null;
}

const EMPTY_STATE: SavingsGoalState = {
  current: null,
  achievedCount: 0,
  accountingVersion: GOAL_ACCOUNTING_VERSION,
};

export interface SavingsGoalInput {
  label: string;
  emoji: string;
  targetAmount: number;
}

export function useSavingsGoal() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const queryClient = useQueryClient();
  const signedIn = isLoaded && !!isSignedIn && !!userId;
  const queryKey = savingsGoalQueryKey(userId);

  const request = async (init?: RequestInit): Promise<Response> => fetch(`${apiBaseUrl()}/api/savings-goal`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${(await getToken()) ?? ''}`,
    },
  });

  const persistState = async (next: SavingsGoalState): Promise<SavingsGoalState> => {
    await setSavingsGoalState(next, signedIn ? userId : undefined);
    if (signedIn) {
      const response = await request({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!response.ok) throw new Error(`Failed to save savings goal (${response.status})`);
    }
    return next;
  };

  const { data, status } = useQuery({
    queryKey,
    enabled: isLoaded,
    queryFn: async (): Promise<SavingsGoalState | null> => {
      const local = await getSavingsGoalState(signedIn ? userId : undefined);
      if (!signedIn) return local;

      try {
        const response = await request();
        if (!response.ok) throw new Error(`Failed to load savings goal (${response.status})`);
        const remote = parseSavingsGoalPayload(await responseJson(response));
        if (remote) {
          const migration = migrateSavingsGoalState(remote);
          await setSavingsGoalState(migration.state, userId);
          if (migration.migrated) {
            await persistState(migration.state).catch(() => migration.state);
          }
          return migration.state;
        }

        // Seed goals created by older app versions into the signed-in account.
        if (local) await persistState(local);
        return local;
      } catch {
        return local;
      }
    },
  });
  const state = data ?? EMPTY_STATE;

  // Set (or replace) the current goal, preserving the lifetime achieved count.
  const { mutate: setGoal } = useMutation({
    mutationFn: async (input: SavingsGoalInput): Promise<SavingsGoalState> => {
      const prev = await getSavingsGoalState(signedIn ? userId : undefined);
      return persistState({
        current: {
          id: `goal-${Date.now()}`,
          label: input.label.trim(),
          emoji: input.emoji,
          targetAmount: Math.max(1, Math.round(input.targetAmount)),
          createdAt: new Date().toISOString(),
        },
        achievedCount: prev?.achievedCount ?? 0,
        accountingVersion: GOAL_ACCOUNTING_VERSION,
      });
    },
    onSuccess: (next) => queryClient.setQueryData(queryKey, next),
  });

  // Mark the current goal reached (idempotent) and bump the lifetime count once.
  const { mutate: markAchieved } = useMutation({
    mutationFn: async (): Promise<SavingsGoalState | null> => {
      const prev = await getSavingsGoalState(signedIn ? userId : undefined);
      if (!prev?.current || prev.current.achievedAt) return null;
      return persistState({
        current: { ...prev.current, achievedAt: new Date().toISOString() },
        achievedCount: prev.achievedCount + 1,
        accountingVersion: GOAL_ACCOUNTING_VERSION,
      });
    },
    onSuccess: (next) => {
      if (!next) return; // already achieved — nothing transitioned, so don't notify twice
      queryClient.setQueryData(queryKey, next);
      if (next.current) void notifyGoalAchieved(next.current);
    },
  });

  // Record that the congratulations screen has been shown, so it shows once.
  const { mutate: markCelebrated } = useMutation({
    mutationFn: async (): Promise<SavingsGoalState | null> => {
      const prev = await getSavingsGoalState(signedIn ? userId : undefined);
      if (!prev?.current?.achievedAt || prev.current.celebratedAt) return null;
      return persistState({
        ...prev,
        current: { ...prev.current, celebratedAt: new Date().toISOString() },
        accountingVersion: GOAL_ACCOUNTING_VERSION,
      });
    },
    onSuccess: (next) => {
      if (next) queryClient.setQueryData(queryKey, next);
    },
  });

  return {
    goal: state.current,
    achievedCount: state.achievedCount,
    hasGoal: !!state.current,
    /** Set while a reached goal still owes the user its congratulations screen. */
    pendingCelebration: pendingCelebrationGoal(state.current),
    isLoading: !isLoaded || status === 'pending',
    setGoal,
    markAchieved,
    markCelebrated,
  };
}
