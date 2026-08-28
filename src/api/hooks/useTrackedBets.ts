import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getTrackedBets, saveTrackedBets } from '@/api/client/storage';
import { deviceQuery } from '@/api/query-client';
import { TrackedBet } from '@/types/bets';

function trackedBetsQueryKey() {
  return ['TRACKED_BETS'] as const;
}

async function addBet(newBet: TrackedBet): Promise<TrackedBet[]> {
  const existing = await getTrackedBets();
  const updated = [newBet, ...existing];
  await saveTrackedBets(updated);
  return updated;
}

async function updateBetStatus(id: string, status: TrackedBet['status']): Promise<TrackedBet[]> {
  const existing = await getTrackedBets();
  const updated = existing.map((b) => (b.id === id ? { ...b, status } : b));
  await saveTrackedBets(updated);
  return updated;
}

async function patchBet(id: string, patch: Partial<TrackedBet>): Promise<TrackedBet[]> {
  const existing = await getTrackedBets();
  const updated = existing.map((b) => (b.id === id ? { ...b, ...patch } : b));
  await saveTrackedBets(updated);
  return updated;
}

/**
 * Move every position from one goal to another. Called before a goal is deleted,
 * so its positions land somewhere real instead of pointing at a goal that's gone.
 */
async function moveBetsToGoal(fromGoalId: string, toGoalId: string | undefined): Promise<TrackedBet[]> {
  const existing = await getTrackedBets();
  const updated = existing.map((b) => (b.goalId === fromGoalId ? { ...b, goalId: toGoalId } : b));
  await saveTrackedBets(updated);
  return updated;
}

export function useTrackedBets() {
  const queryClient = useQueryClient();

  const { data: bets, status } = useQuery({
    queryKey: trackedBetsQueryKey(),
    queryFn: getTrackedBets,
    ...deviceQuery,
  });

  /**
   * Shared optimistic scaffolding for the position list.
   *
   * Every write here is a read-modify-write against AsyncStorage, so the honest
   * answer only exists a round-trip later. The same transformation is applied to
   * the cache immediately, which is what makes a tracked position appear in the
   * list on the frame the sheet closes, and a resolved one leave it on the tap.
   * The pre-mutation list is kept so a failed write puts the row back.
   */
  function optimistic<TInput>(apply: (bets: TrackedBet[], input: TInput) => TrackedBet[]) {
    return {
      onMutate: async (input: TInput) => {
        await queryClient.cancelQueries({ queryKey: trackedBetsQueryKey() });
        const previous = queryClient.getQueryData<TrackedBet[]>(trackedBetsQueryKey()) ?? [];
        queryClient.setQueryData(trackedBetsQueryKey(), apply(previous, input));
        return { previous };
      },
      onError: (_error: unknown, _input: TInput, context: { previous: TrackedBet[] } | undefined) => {
        if (context) queryClient.setQueryData(trackedBetsQueryKey(), context.previous);
      },
      onSettled: () => queryClient.invalidateQueries({ queryKey: trackedBetsQueryKey() }),
    };
  }

  const { mutate: trackBet, isPending: isTracking } = useMutation({
    mutationFn: (bet: TrackedBet) => addBet(bet),
    ...optimistic<TrackedBet>((bets, bet) => [bet, ...bets]),
  });

  const { mutate: resolveBet } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TrackedBet['status'] }) =>
      updateBetStatus(id, status),
    ...optimistic<{ id: string; status: TrackedBet['status'] }>((bets, { id, status }) =>
      bets.map((bet) => (bet.id === id ? { ...bet, status } : bet)),
    ),
  });

  const { mutate: dismissSellAlert } = useMutation({
    mutationFn: (id: string) => patchBet(id, { sellAlertDismissed: true }),
    ...optimistic<string>((bets, id) =>
      bets.map((bet) => (bet.id === id ? { ...bet, sellAlertDismissed: true } : bet)),
    ),
  });

  const { mutateAsync: reassignBets } = useMutation({
    mutationFn: ({ fromGoalId, toGoalId }: { fromGoalId: string; toGoalId?: string }) =>
      moveBetsToGoal(fromGoalId, toGoalId),
    ...optimistic<{ fromGoalId: string; toGoalId?: string }>((bets, { fromGoalId, toGoalId }) =>
      bets.map((bet) => (bet.goalId === fromGoalId ? { ...bet, goalId: toGoalId } : bet)),
    ),
  });

  return {
    bets: bets ?? [],
    isLoading: status === 'pending',
    trackBet,
    isTracking,
    resolveBet,
    dismissSellAlert,
    reassignBets,
  };
}
