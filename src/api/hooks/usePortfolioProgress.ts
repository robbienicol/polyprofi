import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { fetchTrackedAssetQuotes } from '@/api/client/portfolio-live';
import {
  getPortfolioProgress,
  PortfolioProgressPoint,
  recordPortfolioProgress,
} from '@/api/client/storage';
import { useBetMonitoring } from '@/api/hooks/useBetMonitoring';
import { useTrackedBets } from '@/api/hooks/useTrackedBets';
import { calculatePortfolioProgress, stockIdentity } from '@/lib/portfolio-progress';
import { isStockOrEtfCategory } from '@/lib/tracked-assets';

const PROGRESS_QUERY_KEY = ['PORTFOLIO_PROGRESS'] as const;

export function usePortfolioProgress(fallbackBalance: number) {
  const queryClient = useQueryClient();
  const { bets, isLoading: betsLoading } = useTrackedBets();
  const active = useMemo(() => bets.filter((bet) => bet.status === 'active'), [bets]);
  const monitoring = useBetMonitoring(active.length > 0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const symbols = useMemo(
    () => [...new Set(active
      .filter((bet) => isStockOrEtfCategory(bet.category))
      .map((bet) => stockIdentity(bet).symbol)
      .filter((symbol): symbol is string => Boolean(symbol)))],
    [active]
  );

  const quotesQuery = useQuery({
    queryKey: ['TRACKED_ASSET_QUOTES', ...symbols],
    queryFn: () => fetchTrackedAssetQuotes(symbols),
    enabled: symbols.length > 0,
    staleTime: 30_000,
    refetchInterval: symbols.length > 0 ? 60_000 : false,
  });

  const historyQuery = useQuery({
    queryKey: PROGRESS_QUERY_KEY,
    queryFn: getPortfolioProgress,
  });

  const snapshot = useMemo(() => {
    return calculatePortfolioProgress({
      active,
      fallbackBalance,
      statusesById: monitoring.statusById,
      quotes: quotesQuery.data ?? [],
      now,
    });
  }, [active, fallbackBalance, monitoring.statusById, now, quotesQuery.data]);

  useEffect(() => {
    if (betsLoading || historyQuery.isLoading || snapshot.basisValue <= 0) return;

    const point: PortfolioProgressPoint = {
      time: now,
      value: snapshot.value,
      basisValue: snapshot.basisValue,
      livePnl: snapshot.livePnl,
      projectedPnl: snapshot.projectedPnl,
    };
    const basis: PortfolioProgressPoint = {
      time: now - 60_000,
      value: snapshot.basisValue,
      basisValue: snapshot.basisValue,
      livePnl: 0,
      projectedPnl: 0,
    };

    recordPortfolioProgress(point, basis).then((points) => {
      queryClient.setQueryData(PROGRESS_QUERY_KEY, points);
    }).catch(() => {});
  }, [active, betsLoading, historyQuery.isLoading, now, queryClient, snapshot]);

  const refresh = useCallback(async () => {
    setNow(Date.now());
    await Promise.all([
      monitoring.refetch(),
      symbols.length > 0 ? quotesQuery.refetch() : Promise.resolve(),
    ]);
  }, [monitoring, quotesQuery, symbols.length]);

  const updatedAt = Math.max(
    monitoring.lastUpdated?.getTime() ?? 0,
    quotesQuery.dataUpdatedAt,
    snapshot.projectedPositions > 0 ? now : 0
  );

  return {
    ...snapshot,
    points: historyQuery.data ?? [],
    activeCount: active.length,
    isLoading: betsLoading || historyQuery.isLoading,
    isRefreshing: monitoring.isFetching || quotesQuery.isFetching,
    updatedAt: updatedAt > 0 ? new Date(updatedAt) : null,
    observedAt: now,
    statusById: monitoring.statusById,
    sellAlerts: monitoring.sellAlerts,
    refresh,
  };
}
