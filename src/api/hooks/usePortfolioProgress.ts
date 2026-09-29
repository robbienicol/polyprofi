import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { fetchTrackedAssetQuotes } from '@/api/client/portfolio-live';
import {
  getPortfolioProgress,
  PortfolioProgressPoint,
  recordPortfolioProgress,
} from '@/api/client/storage';
import { deviceQuery } from '@/api/query-client';
import { useBetMonitoring } from '@/api/hooks/useBetMonitoring';
import { useTrackedBets } from '@/api/hooks/useTrackedBets';
import { calculatePortfolioProgress, stockIdentity } from '@/lib/portfolio-progress';
import { notifyPositionResolved } from '@/lib/notifications';
import { isStockOrEtfCategory } from '@/lib/tracked-assets';
import type { TrackedBet } from '@/types/bets';

const PROGRESS_QUERY_KEY = ['PORTFOLIO_PROGRESS'] as const;

/**
 * Positions already handed to resolveBet this session. The resolve effect below runs
 * in every mounted copy of this hook (root alerts, Home, Portfolio, Goals), so without
 * a shared record one settled market resolved — and notified — once per copy.
 */
const resolvingIds = new Set<string>();

/**
 * Live inputs every progress calculation needs: the monitoring feed, refreshed
 * asset quotes and a ticking clock. Shared so that valuing one goal, all goals,
 * or the whole portfolio costs exactly one set of fetches.
 */
export function usePortfolioMarketInputs() {
  const { bets, isLoading: betsLoading, resolveBet } = useTrackedBets();
  const allActive = useMemo(() => bets.filter((bet) => bet.status === 'active'), [bets]);
  const monitoring = useBetMonitoring(allActive.length > 0);
  const [now, setNow] = useState(() => Date.now());

  // A market that has actually settled or a game that has actually ended
  // resolves itself — the user tapping Won/Lost was never telling us anything
  // the market didn't already know. Keyed off `allActive` so a bet drops out
  // (and stops re-firing) the instant its own resolveBet call lands and flips
  // its status — no separate "already resolved" bookkeeping needed.
  useEffect(() => {
    for (const bet of allActive) {
      const status = monitoring.statusById[bet.id];
      if (!status?.resolvedStatus || resolvingIds.has(bet.id)) continue;
      resolvingIds.add(bet.id);
      resolveBet({ id: bet.id, status: status.resolvedStatus });
      const verb = status.resolvedStatus === 'won' ? 'won' : "didn't hit";
      void notifyPositionResolved(
        `${bet.emoji} Position resolved`,
        `${bet.description.length > 80 ? `${bet.description.slice(0, 80)}…` : bet.description} — you ${verb}.`,
      );
    }
  }, [allActive, monitoring.statusById, resolveBet]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const symbols = useMemo(
    () => [...new Set(allActive
      .filter((bet) => isStockOrEtfCategory(bet.category))
      .map((bet) => stockIdentity(bet).symbol)
      .filter((symbol): symbol is string => Boolean(symbol)))],
    [allActive]
  );

  const quotesQuery = useQuery({
    queryKey: ['TRACKED_ASSET_QUOTES', ...symbols],
    queryFn: () => fetchTrackedAssetQuotes(symbols),
    enabled: symbols.length > 0,
    // Often enough that the tip of the chart visibly moves while the market is open.
    staleTime: 10_000,
    refetchInterval: symbols.length > 0 ? 15_000 : false,
  });

  const refresh = useCallback(async () => {
    setNow(Date.now());
    await Promise.all([
      monitoring.refetch(),
      symbols.length > 0 ? quotesQuery.refetch() : Promise.resolve(),
    ]);
  }, [monitoring, quotesQuery, symbols.length]);

  return {
    allBets: bets,
    allActive,
    betsLoading,
    now,
    quotes: quotesQuery.data ?? [],
    quotesUpdatedAt: quotesQuery.dataUpdatedAt,
    statusById: monitoring.statusById,
    sellAlerts: monitoring.sellAlerts,
    monitoringUpdatedAt: monitoring.lastUpdated?.getTime() ?? 0,
    isRefreshing: monitoring.isFetching || quotesQuery.isFetching,
    refresh,
  };
}

export interface PortfolioProgressOptions {
  /**
   * Restrict the snapshot to one goal's positions. Live prices and the monitoring
   * feed are still requested for every position, so a scoped call reuses the same
   * query cache as the whole-portfolio call rather than starting its own fetches.
   */
  scopeToBets?: (bets: TrackedBet[]) => TrackedBet[];
  /**
   * Whether to append to the stored portfolio history. Only the whole-portfolio
   * call may — a scoped snapshot would write a smaller value into the same series.
   */
  recordHistory?: boolean;
}

export function usePortfolioProgress(fallbackBalance: number, options: PortfolioProgressOptions = {}) {
  const { scopeToBets, recordHistory = true } = options;
  const queryClient = useQueryClient();
  const market = usePortfolioMarketInputs();
  const { allActive, betsLoading, now, quotes, statusById } = market;
  const active = useMemo(() => (scopeToBets ? scopeToBets(allActive) : allActive), [allActive, scopeToBets]);

  const historyQuery = useQuery({
    queryKey: PROGRESS_QUERY_KEY,
    queryFn: getPortfolioProgress,
    // The series only ever grows through the recorder below, which writes the
    // cache itself. Re-reading it from disk on every mount redrew the chart.
    ...deviceQuery,
  });

  const snapshot = useMemo(() => {
    return calculatePortfolioProgress({
      active,
      fallbackBalance,
      statusesById: statusById,
      quotes,
      now,
    });
  }, [active, fallbackBalance, statusById, now, quotes]);

  useEffect(() => {
    if (!recordHistory || betsLoading || historyQuery.isLoading || snapshot.basisValue <= 0) return;

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
  }, [active, betsLoading, historyQuery.isLoading, now, queryClient, recordHistory, snapshot]);

  const updatedAt = Math.max(
    market.monitoringUpdatedAt,
    market.quotesUpdatedAt,
    snapshot.projectedPositions > 0 ? now : 0
  );

  return {
    ...snapshot,
    points: historyQuery.data ?? [],
    activeCount: active.length,
    isLoading: betsLoading || historyQuery.isLoading,
    isRefreshing: market.isRefreshing,
    updatedAt: updatedAt > 0 ? new Date(updatedAt) : null,
    observedAt: now,
    statusById,
    sellAlerts: market.sellAlerts,
    refresh: market.refresh,
  };
}
