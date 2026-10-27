import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';

import { fetchLiveStatuses } from '@/api/client/live-positions';
import { useTrackedBets } from '@/api/hooks/useTrackedBets';
import { BetLiveStatus } from '@/types/bets';

function betMonitoringQueryKey(betIds: string[]) {
  return ['BET_MONITORING', ...betIds.sort()] as const;
}

export function useBetMonitoring(enabled = true) {
  const { bets } = useTrackedBets();
  const { getToken } = useAuth();
  const activeIds = bets.filter((b) => b.status === 'active').map((b) => b.id);

  const { data, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: betMonitoringQueryKey(activeIds),
    queryFn: () => fetchLiveStatuses(bets, getToken),
    enabled: enabled && activeIds.length > 0,
    staleTime: 30_000,
    refetchInterval: enabled && activeIds.length > 0 ? 60_000 : false,
  });

  const statusById = (data ?? []).reduce<Record<string, BetLiveStatus>>((acc, s) => {
    acc[s.betId] = s;
    return acc;
  }, {});

  const sellAlerts = (data ?? []).filter((s) => s.sellRecommended);

  return {
    statuses: data ?? [],
    statusById,
    sellAlerts,
    isFetching,
    refetch,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
  };
}
