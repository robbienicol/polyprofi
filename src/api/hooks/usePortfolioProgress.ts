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
import { isPredictionMarketBet } from '@/lib/parse-bet-line';
import {
  inferAssetEntryPrice,
  inferAssetSymbol,
  inferAnnualYieldPct,
  inferMaturityDays,
  isSavingsOrTreasuryCategory,
  isStockOrEtfCategory,
} from '@/lib/tracked-assets';
import { TrackedBet } from '@/types/bets';

const PROGRESS_QUERY_KEY = ['PORTFOLIO_PROGRESS'] as const;
const YEAR_MS = 365 * 24 * 60 * 60 * 1_000;

function projectedAccrual(bet: TrackedBet, now: number): number {
  const elapsedMs = Math.max(0, now - new Date(bet.createdAt).getTime());
  const maturityDays = bet.maturesInDays ?? inferMaturityDays(bet.description, bet.strategy);
  const annualYieldPct = bet.annualYieldPct ?? inferAnnualYieldPct(bet.description, bet.strategy);
  const cappedMs = maturityDays
    ? Math.min(elapsedMs, maturityDays * 24 * 60 * 60 * 1_000)
    : elapsedMs;

  if (annualYieldPct != null) {
    return bet.amountWagered * (annualYieldPct / 100) * (cappedMs / YEAR_MS);
  }
  if (maturityDays && maturityDays > 0) {
    return bet.expectedReturn * Math.min(1, cappedMs / (maturityDays * 24 * 60 * 60 * 1_000));
  }
  return 0;
}

function stockIdentity(bet: TrackedBet): { symbol?: string; entryPrice?: number } {
  return {
    symbol: bet.assetSymbol ?? inferAssetSymbol(bet.description, bet.strategy, bet.line),
    entryPrice: bet.assetEntryPrice ?? inferAssetEntryPrice(bet.description, bet.strategy),
  };
}

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
    const quoteBySymbol = new Map((quotesQuery.data ?? []).map((quote) => [quote.symbol, quote]));
    const activeStake = active.reduce((sum, bet) => sum + bet.amountWagered, 0);
    const basisValue = Math.max(fallbackBalance, activeStake);
    const cash = Math.max(0, basisValue - activeStake);
    let investedValue = 0;
    let livePnl = 0;
    let projectedPnl = 0;
    let livePositions = 0;
    let projectedPositions = 0;

    for (const bet of active) {
      let pnl = 0;

      if (isPredictionMarketBet(bet)) {
        const status = monitoring.statusById[bet.id];
        if (status?.currentPrice != null) {
          pnl = status.unrealizedPnl;
          livePnl += pnl;
          livePositions += 1;
        }
      } else if (isStockOrEtfCategory(bet.category)) {
        const { symbol, entryPrice } = stockIdentity(bet);
        const quote = symbol ? quoteBySymbol.get(symbol) : undefined;
        if (quote && entryPrice && entryPrice > 0) {
          pnl = (bet.amountWagered / entryPrice) * (quote.price - entryPrice);
          livePnl += pnl;
          livePositions += 1;
        }
      } else if (isSavingsOrTreasuryCategory(bet.category)) {
        pnl = projectedAccrual(bet, now);
        projectedPnl += pnl;
        projectedPositions += 1;
      }

      investedValue += bet.amountWagered + pnl;
    }

    return {
      value: cash + investedValue,
      basisValue,
      activeStake,
      livePnl,
      projectedPnl,
      livePositions,
      projectedPositions,
    };
  }, [active, fallbackBalance, monitoring.statusById, now, quotesQuery.data]);

  useEffect(() => {
    if (betsLoading || historyQuery.isLoading || snapshot.basisValue <= 0) return;

    const point: PortfolioProgressPoint = {
      time: now,
      value: snapshot.value,
      livePnl: snapshot.livePnl,
      projectedPnl: snapshot.projectedPnl,
    };
    const basis: PortfolioProgressPoint = {
      time: now - 60_000,
      value: snapshot.value,
      livePnl: snapshot.livePnl,
      projectedPnl: snapshot.projectedPnl,
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
    refresh,
  };
}
