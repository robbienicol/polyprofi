import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getSavingsGoalState, setSavingsGoalState } from '@/api/client/storage';
import { apiBaseUrl } from '@/lib/api-base-url';
import { isRecord, isSavingsGoalState, responseJson } from '@/lib/runtime-validation';
import { notifyGoalAchieved } from '@/lib/notifications';
import {
  committedGoals,
  GOAL_ACCOUNTING_VERSION,
  migrateSavingsGoalState,
  pendingCelebrationGoal,
} from '@/lib/savings-goal';
import type { LegacySavingsGoalState, SavingsGoal, SavingsGoalState } from '@/types/bets';

function savingsGoalQueryKey(userId: string | null | undefined) {
  return ['SAVINGS_GOAL', userId ?? 'local'] as const;
}

function parseSavingsGoalPayload(value: unknown): SavingsGoalState | LegacySavingsGoalState | null {
  if (!isRecord(value)) return null;
  return value.savingsGoalState === null || isSavingsGoalState(value.savingsGoalState)
    ? value.savingsGoalState
    : null;
}

const EMPTY_STATE: SavingsGoalState = {
  goals: [],
  achievedCount: 0,
  accountingVersion: GOAL_ACCOUNTING_VERSION,
};

export interface SavingsGoalInput {
  label: string;
  emoji: string;
  /** Omitted for an open-ended goal ("just grow my money"), which has no finish line. */
  targetAmount?: number;
  /** Set for a goal a route search named but nothing has been acquired against yet. */
  draft?: boolean;
  /** ISO deadline from the search, after which an unused draft is swept away. */
  deadline?: string;
}

function buildGoal(input: SavingsGoalInput): SavingsGoal {
  const target = input.targetAmount != null ? Math.max(1, Math.round(input.targetAmount)) : undefined;
  return {
    id: `goal-${Date.now()}`,
    label: input.label.trim(),
    emoji: input.emoji,
    ...(target != null ? { targetAmount: target } : null),
    ...(input.draft ? { draft: true } : null),
    ...(input.deadline ? { deadline: input.deadline } : null),
    createdAt: new Date().toISOString(),
  };
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

  /** Read-modify-write against storage, so concurrent goal edits can't drop each other. */
  const mutateState = async (
    change: (prev: SavingsGoalState) => SavingsGoalState | null,
  ): Promise<SavingsGoalState | null> => {
    const stored = await getSavingsGoalState(signedIn ? userId : undefined);
    const next = change(stored ?? EMPTY_STATE);
    return next ? persistState(next) : null;
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

  // Add a goal. Existing goals and their positions stay put.
  const { mutate: addGoal, mutateAsync: addGoalAsync } = useMutation({
    mutationFn: async (input: SavingsGoalInput): Promise<{ state: SavingsGoalState; goal: SavingsGoal }> => {
      const goal = buildGoal(input);
      const state = await mutateState((prev) => ({
        ...prev,
        goals: [...prev.goals, goal],
        accountingVersion: GOAL_ACCOUNTING_VERSION,
      }));
      // mutateState only returns null when the change function declines, which
      // adding never does.
      return { state: state as SavingsGoalState, goal };
    },
    onSuccess: (result) => queryClient.setQueryData(queryKey, result.state),
  });

  // Promote a draft into a real goal. Called when the user acquires against it:
  // committing money is what turns a search into something worth tracking.
  const { mutate: confirmGoal } = useMutation({
    mutationFn: async (goalId: string): Promise<SavingsGoalState | null> =>
      mutateState((prev) => {
        const target = prev.goals.find((goal) => goal.id === goalId);
        if (!target?.draft) return null;
        const confirmed = { ...target };
        delete confirmed.draft;
        return { ...prev, goals: prev.goals.map((goal) => (goal.id === goalId ? confirmed : goal)) };
      }),
    onSuccess: (next) => {
      if (next) queryClient.setQueryData(queryKey, next);
    },
  });

  // Drop a goal. Its positions are reassigned by the caller before this runs —
  // see reassignBets in useTrackedBets — so nothing is left pointing at nothing.
  const { mutate: removeGoal } = useMutation({
    mutationFn: async (goalId: string): Promise<SavingsGoalState | null> =>
      mutateState((prev) => {
        const goals = prev.goals.filter((goal) => goal.id !== goalId);
        return goals.length === prev.goals.length ? null : { ...prev, goals };
      }),
    onSuccess: (next) => {
      if (next) queryClient.setQueryData(queryKey, next);
    },
  });

  // Mark one goal reached (idempotent) and bump the lifetime count once.
  const { mutate: markAchieved } = useMutation({
    mutationFn: async (goalId: string): Promise<{ state: SavingsGoalState; goal: SavingsGoal } | null> => {
      let achieved: SavingsGoal | null = null;
      const next = await mutateState((prev) => {
        const target = prev.goals.find((goal) => goal.id === goalId);
        if (!target || target.achievedAt) return null;
        achieved = { ...target, achievedAt: new Date().toISOString() };
        return {
          ...prev,
          goals: prev.goals.map((goal) => (goal.id === goalId ? achieved! : goal)),
          achievedCount: prev.achievedCount + 1,
          accountingVersion: GOAL_ACCOUNTING_VERSION,
        };
      });
      return next && achieved ? { state: next, goal: achieved } : null;
    },
    onSuccess: (result) => {
      if (!result) return; // already achieved — nothing transitioned, so don't notify twice
      queryClient.setQueryData(queryKey, result.state);
      void notifyGoalAchieved(result.goal);
    },
  });

  // Record that the congratulations screen has been shown, so it shows once.
  const { mutate: markCelebrated } = useMutation({
    mutationFn: async (goalId: string): Promise<SavingsGoalState | null> =>
      mutateState((prev) => {
        const target = prev.goals.find((goal) => goal.id === goalId);
        if (!target?.achievedAt || target.celebratedAt) return null;
        const celebrated = { ...target, celebratedAt: new Date().toISOString() };
        return { ...prev, goals: prev.goals.map((goal) => (goal.id === goalId ? celebrated : goal)) };
      }),
    onSuccess: (next) => {
      if (next) queryClient.setQueryData(queryKey, next);
    },
  });

  const committed = committedGoals(state.goals);

  return {
    /** Goals the user has committed to. Drafts from unacted searches are excluded. */
    goals: committed,
    /** Every goal including drafts — for resolving a goalId a search is carrying. */
    allGoals: state.goals,
    achievedCount: state.achievedCount,
    hasGoal: committed.length > 0,
    /** Set while a reached goal still owes the user its congratulations screen. */
    pendingCelebration: pendingCelebrationGoal(state.goals),
    isLoading: !isLoaded || status === 'pending',
    addGoal,
    /** Resolves with the created goal, for callers that need its id straight away. */
    addGoalAsync,
    confirmGoal,
    removeGoal,
    markAchieved,
    markCelebrated,
  };
}
