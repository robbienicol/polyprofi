import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getSavingsGoalState,
  isSavingsGoalUnsynced,
  setSavingsGoalState,
  setSavingsGoalUnsynced,
} from '@/api/client/storage';
import { deviceQuery } from '@/api/query-client';
import { apiBaseUrl } from '@/lib/api-base-url';
import { isRecord, isSavingsGoalState, responseJson } from '@/lib/runtime-validation';
import { goalReachedMessage } from '@/lib/alert-messages';
import { notifyAlert } from '@/lib/notifications';
import { committedGoals, migrateSavingsGoalState, pendingCelebrationGoal } from '@/lib/savings-goal';
import {
  achieveGoal,
  addGoalTo,
  buildGoal,
  celebrateGoal,
  confirmDraft,
  dropGoals,
  EMPTY_STATE,
  type SavingsGoalInput,
} from '@/api/hooks/savings-goal-transforms';
import type { LegacySavingsGoalState, SavingsGoal, SavingsGoalState } from '@/types/bets';

export type { SavingsGoalInput } from '@/api/hooks/savings-goal-transforms';

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

/** Runs `write` after every write already queued. */
function enqueueGoalWrite<T>(write: () => Promise<T>): Promise<T> {
  const run = goalWriteQueue.then(write, write);
  goalWriteQueue = run.catch(() => undefined);
  return run;
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
    return enqueueGoalWrite(write);
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

  // The goal is built by the caller-facing wrapper below rather than inside
  // mutationFn, so the row the cache shows immediately carries the same id the
  // one written to disk does — the quiz navigates on that id.
  const { mutate: addGoalRaw, mutateAsync: addGoalRawAsync } = useMutation({
    mutationFn: async (goal: SavingsGoal): Promise<SavingsGoalState> => {
      const state = await mutateState((prev) => addGoalTo(prev, goal));
      // mutateState only returns null when the change function declines, which
      // adding never does.
      return state as SavingsGoalState;
    },
    ...optimistic<SavingsGoal>(addGoalTo),
    onSuccess: (state) => queryClient.setQueryData(queryKey, state),
  });

  const addGoal = (input: SavingsGoalInput, options?: Parameters<typeof addGoalRaw>[1]): void =>
      addGoalRaw(buildGoal(input), options);

  const addGoalAsync = async (input: SavingsGoalInput): Promise<{ state: SavingsGoalState; goal: SavingsGoal }> => {
      const goal = buildGoal(input);
      return { state: await addGoalRawAsync(goal), goal };
    };

  const writeCache = (next: SavingsGoalState | null) => {
    if (next) queryClient.setQueryData(queryKey, next);
  };

  const { mutate: confirmGoal } = useMutation({
    mutationFn: async (goalId: string): Promise<SavingsGoalState | null> =>
      mutateState((prev) => confirmDraft(prev, goalId)),
    ...optimistic<string>(confirmDraft),
    onSuccess: writeCache,
  });

  const { mutate: removeGoals } = useMutation({
    mutationFn: async (goalIds: string[]): Promise<SavingsGoalState | null> =>
      mutateState((prev) => dropGoals(prev, goalIds)),
    ...optimistic<string[]>(dropGoals),
    onSuccess: writeCache,
  });

  const removeGoal = (goalId: string): void => removeGoals([goalId]);

  const { mutate: markAchieved } = useMutation({
    mutationFn: async (goalId: string): Promise<{ state: SavingsGoalState; goal: SavingsGoal } | null> => {
      const next = await mutateState((prev) => achieveGoal(prev, goalId));
      const achieved = next?.goals.find((goal) => goal.id === goalId);
      return next && achieved ? { state: next, goal: achieved } : null;
    },
    ...optimistic<string>(achieveGoal),
    onSuccess: (result) => {
      if (!result) return; // already achieved — nothing transitioned, so don't notify twice
      queryClient.setQueryData(queryKey, result.state);
      void notifyAlert(goalReachedMessage(result.goal));
    },
  });

  const { mutate: markCelebrated } = useMutation({
    mutationFn: async (goalId: string): Promise<SavingsGoalState | null> =>
      mutateState((prev) => celebrateGoal(prev, goalId)),
    ...optimistic<string>(celebrateGoal),
    onSuccess: writeCache,
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
