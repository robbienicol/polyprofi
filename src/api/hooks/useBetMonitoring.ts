import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { fetchAllBetStatuses } from '@/api/client/bet-monitor';
import { useTrackedBets } from '@/api/hooks/useTrackedBets';
import { BetLiveStatus } from '@/types/bets';

function betMonitoringQueryKey(betIds: string[]) {
  return ['BET_MONITORING', ...betIds.sort()] as const;
}

export function useBetMonitoring(enabled = true) {
  const { bets } = useTrackedBets();
  const activeIds = bets.filter((b) => b.status === 'active').map((b) => b.id);

  const { data, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: betMonitoringQueryKey(activeIds),
    queryFn: () => fetchAllBetStatuses(bets),
    enabled: enabled && activeIds.length > 0,
    staleTime: 30_000,
    refetchInterval: enabled && activeIds.length > 0 ? 60_000 : false,
  });

  const statusById = useMemo(() => (data ?? []).reduce<Record<string, BetLiveStatus>>((acc, s) => {
    acc[s.betId] = s;
    return acc;
  }, {}), [data]);

  const sellAlerts = useMemo(() => (data ?? []).filter((s) => s.sellRecommended), [data]);

  return {
    statuses: data ?? [],
    statusById,
    sellAlerts,
    isFetching,
    refetch,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
  };
}
