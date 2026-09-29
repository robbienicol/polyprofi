import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  getSavingsGoalState,
  isSavingsGoalUnsynced,
  setSavingsGoalState,
  setSavingsGoalUnsynced,
} from '@/api/client/storage';
import { deviceQuery } from '@/api/query-client';
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

/** Goal writes run one at a time — see mutateState. Module-level so every hook instance shares it. */
let goalWriteQueue: Promise<unknown> = Promise.resolve();

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

  /** POSTs the state; true when the server has it. Never throws. */
  const pushToServer = async (next: SavingsGoalState): Promise<boolean> => {
    try {
      const response = await request({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  /**
   * Device first, server second. A goal saved with no connection is a real save:
   * it is kept on the device and flagged unsynced, and the next load pushes it up
   * instead of letting the server's older copy overwrite it. Before this, the
   * server copy always won, so a goal added offline — and every position taken
   * against it — silently vanished the next time the app was online.
   */
  const persistState = async (next: SavingsGoalState): Promise<SavingsGoalState> => {
    await setSavingsGoalState(next, signedIn ? userId : undefined);
    if (signedIn) {
      await setSavingsGoalUnsynced(userId, true);
      if (await pushToServer(next)) await setSavingsGoalUnsynced(userId, false);
    }
    return next;
  };

  /** Read-modify-write against storage, so concurrent goal edits can't drop each other. */
  const mutateState = async (
    change: (prev: SavingsGoalState) => SavingsGoalState | null,
  ): Promise<SavingsGoalState | null> => {
    // Chained, so two edits in quick succession (maintenance marking a goal reached
    // while the user adds one) can't both read the old list and drop each other.
    const write = async (): Promise<SavingsGoalState | null> => {
      const stored = await getSavingsGoalState(signedIn ? userId : undefined);
      const next = change(stored ?? EMPTY_STATE);
      return next ? persistState(next) : null;
    };
    const run = goalWriteQueue.then(write, write);
    goalWriteQueue = run.catch(() => undefined);
    return run;
  };

  const { data, status } = useQuery({
    queryKey,
    enabled: isLoaded,
    queryFn: async (): Promise<SavingsGoalState | null> => {
      const local = await getSavingsGoalState(signedIn ? userId : undefined);
      if (!signedIn) return local;

      // A change the server never received wins over the server's copy: send it
      // now, and keep showing it whether or not that works.
      if (local && (await isSavingsGoalUnsynced(userId))) {
        if (await pushToServer(local)) await setSavingsGoalUnsynced(userId, false);
        return local;
      }

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
    // Goals change through the mutations below, which write the cache as they go.
    // Refetching on mount re-ran the whole load-migrate-seed dance and made the
    // goal list blink between the local and the server answer.
    ...deviceQuery,
    // Coming back online is the one moment worth a re-read: it is when an offline
    // change finally reaches the server.
    refetchOnReconnect: 'always',
  });
  const state = data ?? EMPTY_STATE;

  /**
   * Shared optimistic scaffolding for goal edits.
   *
   * Each mutation persists through a read-modify-write against storage and, when
   * signed in, a POST on top of that — far too slow for a list the user just
   * tapped. `apply` is the same transformation run against the cache up front;
   * returning null means the change declined (already achieved, nothing to
   * remove) and leaves the cache alone, matching what mutateState does on disk.
   */
  function optimistic<TInput>(apply: (state: SavingsGoalState, input: TInput) => SavingsGoalState | null) {
    return {
      onMutate: async (input: TInput) => {
        await queryClient.cancelQueries({ queryKey });
        const previous = queryClient.getQueryData<SavingsGoalState | null>(queryKey);
        const next = apply(previous ?? EMPTY_STATE, input);
        if (next) queryClient.setQueryData(queryKey, next);
        return { previous };
      },
      onError: (_error: unknown, _input: TInput, context: { previous: SavingsGoalState | null | undefined } | undefined) => {
        queryClient.setQueryData(queryKey, context?.previous ?? null);
      },
      // Whatever happened, re-read the source of truth once the write settles. On
      // success it confirms what the cache already shows; on a failed POST it pulls
      // back what was actually stored rather than trusting the rollback snapshot.
      // Skipped while another write is still in flight (this one counts as 1):
      // refetching then would overwrite that write's optimistic row mid-flight.
      onSettled: () => {
        if (queryClient.isMutating() <= 1) void queryClient.invalidateQueries({ queryKey });
      },
    };
  }

  // Add a goal. Existing goals and their positions stay put.
  //
  // The goal is built by the caller-facing wrapper below rather than inside
  // mutationFn, so the row the cache shows immediately carries the same id the
  // one written to disk does — the quiz navigates on that id.
  const { mutate: addGoalRaw, mutateAsync: addGoalRawAsync } = useMutation({
    mutationFn: async (goal: SavingsGoal): Promise<SavingsGoalState> => {
      const state = await mutateState((prev) => ({
        ...prev,
        goals: [...prev.goals, goal],
        accountingVersion: GOAL_ACCOUNTING_VERSION,
      }));
      // mutateState only returns null when the change function declines, which
      // adding never does.
      return state as SavingsGoalState;
    },
    ...optimistic<SavingsGoal>((prev, goal) => ({
      ...prev,
      goals: [...prev.goals, goal],
      accountingVersion: GOAL_ACCOUNTING_VERSION,
    })),
    onSuccess: (state) => queryClient.setQueryData(queryKey, state),
  });

  const addGoal = useCallback(
    (input: SavingsGoalInput, options?: Parameters<typeof addGoalRaw>[1]): void =>
      addGoalRaw(buildGoal(input), options),
    [addGoalRaw],
  );

  const addGoalAsync = useCallback(
    async (input: SavingsGoalInput): Promise<{ state: SavingsGoalState; goal: SavingsGoal }> => {
      const goal = buildGoal(input);
      return { state: await addGoalRawAsync(goal), goal };
    },
    [addGoalRawAsync],
  );

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
    ...optimistic<string>((prev, goalId) => {
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

  // Drop goals. Their positions are reassigned by the caller before this runs —
  // see reassignBets in useTrackedBets — so nothing is left pointing at nothing.
  //
  // Takes a list rather than one id: every write here is a read-modify-write against
  // storage, so removing three goals with three calls can interleave and resurrect
  // the ones whose read happened before the others' writes landed.
  const dropGoals = (prev: SavingsGoalState, goalIds: string[]): SavingsGoalState | null => {
    const drop = new Set(goalIds);
    const goals = prev.goals.filter((goal) => !drop.has(goal.id));
    return goals.length === prev.goals.length ? null : { ...prev, goals };
  };

  const { mutate: removeGoals } = useMutation({
    mutationFn: async (goalIds: string[]): Promise<SavingsGoalState | null> =>
      mutateState((prev) => dropGoals(prev, goalIds)),
    ...optimistic<string[]>(dropGoals),
    onSuccess: (next) => {
      if (next) queryClient.setQueryData(queryKey, next);
    },
  });

  const removeGoal = useCallback((goalId: string): void => removeGoals([goalId]), [removeGoals]);

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
    ...optimistic<string>((prev, goalId) => {
      const target = prev.goals.find((goal) => goal.id === goalId);
      if (!target || target.achievedAt) return null;
      const achieved = { ...target, achievedAt: new Date().toISOString() };
      return {
        ...prev,
        goals: prev.goals.map((goal) => (goal.id === goalId ? achieved : goal)),
        achievedCount: prev.achievedCount + 1,
        accountingVersion: GOAL_ACCOUNTING_VERSION,
      };
    }),
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
    ...optimistic<string>((prev, goalId) => {
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
    /**
     * Any goal at all, drafts included. The launch gate asks this rather than
     * `hasGoal`: someone who named a goal and ran a search has answered "what are
     * you saving for?", and sending them back to goal setup on every launch until
     * they commit money would be asking it again.
     */
    hasAnyGoal: state.goals.length > 0,
    /** Set while a reached goal still owes the user its congratulations screen. */
    pendingCelebration: pendingCelebrationGoal(state.goals),
    isLoading: !isLoaded || status === 'pending',
    addGoal,
    /** Resolves with the created goal, for callers that need its id straight away. */
    addGoalAsync,
    confirmGoal,
    removeGoal,
    /** Several at once, in one write — see dropGoals. */
    removeGoals,
    markAchieved,
    markCelebrated,
  };
}
