import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getTrackedBets, saveTrackedBets } from '@/api/client/storage';
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

export function useTrackedBets() {
  const queryClient = useQueryClient();

  const { data: bets, status } = useQuery({
    queryKey: trackedBetsQueryKey(),
    queryFn: getTrackedBets,
  });

  const { mutate: trackBet, isPending: isTracking } = useMutation({
    mutationFn: (bet: TrackedBet) => addBet(bet),
    onSettled: () => queryClient.invalidateQueries({ queryKey: trackedBetsQueryKey() }),
  });

  const { mutate: resolveBet } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TrackedBet['status'] }) =>
      updateBetStatus(id, status),
    onSettled: () => queryClient.invalidateQueries({ queryKey: trackedBetsQueryKey() }),
  });

  const { mutate: dismissSellAlert } = useMutation({
    mutationFn: (id: string) => patchBet(id, { sellAlertDismissed: true }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: trackedBetsQueryKey() }),
  });

  return {
    bets: bets ?? [],
    isLoading: status === 'pending',
    trackBet,
    isTracking,
    resolveBet,
    dismissSellAlert,
  };
}
