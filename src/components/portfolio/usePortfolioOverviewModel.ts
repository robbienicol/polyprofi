import { useState } from 'react';

import type { PortfolioProgressPoint } from '@/api/client/storage';
import { usePortfolioSeries } from '@/api/hooks/usePortfolioSeries';
import type { PortfolioRange } from '@/components/molecules/PortfolioLineChart';
import type { PortfolioOverviewProps } from '@/components/portfolio/PortfolioOverview';
import { buildAllocationRows } from '@/components/portfolio/PortfolioVisuals';
import { portfolioStats } from '@/lib/portfolio';
import { cashFlowAdjustedChange, type PositionValuation } from '@/lib/portfolio-progress';
import { outcomeRange } from '@/lib/portfolio-shape';
import type { TrackedBet } from '@/types/bets';

const NO_BETS: TrackedBet[] = [];
const NO_VALUATIONS: Record<string, PositionValuation> = {};

export type AllocationMetric = 'share' | 'return';

/** Which figure the hero shows: measured worth today, or the odds-weighted outcome. */
export type ValueView = 'now' | 'expected';

export type PortfolioOverviewModel = ReturnType<typeof usePortfolioOverviewModel>;

/**
 * Every number PortfolioOverview draws, and the state behind its switches, in one
 * place — so the sections below can stay pure layout.
 */
export function usePortfolioOverviewModel({
  bets,
  fallbackCash,
  valueNow,
  chart,
  positionById,
}: Pick<PortfolioOverviewProps, 'bets' | 'fallbackCash' | 'valueNow' | 'chart' | 'positionById'>) {
  // Every projection here is the plain model. The old "Conservative" switch zeroed
  // stocks and crypto, which is a fourth scenario nobody could place; the downside,
  // expected and upside figures below say what it was reaching for.
  const conservative = false;
  const [metric, setMetric] = useState<AllocationMetric>('share');
  const [valueView, setValueView] = useState<ValueView>('now');

  const activeBets = bets.filter((bet) => bet.status === 'active');
  const stats = portfolioStats(bets, conservative);
  const rows = buildAllocationRows(bets, fallbackCash, conservative);
  const outcomes = outcomeRange(bets);
  // Break-even only gets a mark when it actually falls on the bar.
  const breakEvenPosition = outcomes.best > outcomes.worst
    && outcomes.staked >= outcomes.worst
    && outcomes.staked <= outcomes.best
    ? (outcomes.staked - outcomes.worst) / (outcomes.best - outcomes.worst)
    : null;

  const staked = activeBets.reduce((sum, bet) => sum + bet.amountWagered, 0);
  // Falls back to the principal rather than to a modelled figure: before any price
  // arrives, what you put in is the only thing actually known.
  const value = valueNow?.value ?? staked;
  const netPnl = valueNow?.netPnl ?? 0;
  const netPct = staked > 0 ? (netPnl / staked) * 100 : 0;
  const positive = netPnl >= 0;
  const expectedProfit = activeBets.length > 0 ? stats.totalEv : 0;
  const showExpected = valueView === 'expected';
  // Measured from entry, like the EV it is built from (p x payout − (1−p) x stake),
  // so it is staked + EV rather than today's value + EV. Adding EV to a price that
  // has already moved toward the outcome would count that move twice.
  const projectedValue = staked + expectedProfit;
  // The horizon the expectation belongs to. Without it, a 3-day bet and a 5-month
  // bond get summed into one number with no date attached to it.
  const longestMaturity = activeBets.reduce(
    (longest, bet) => Math.max(longest, bet.maturesInDays ?? 0),
    0,
  );
  const [range, setRange] = useState<PortfolioRange>('1D');
  const [scrubbed, setScrubbed] = useState<PortfolioProgressPoint | null>(null);
  const { series } = usePortfolioSeries({
    bets: chart ? activeBets : NO_BETS,
    range,
    live: chart?.live ?? null,
    positionById: positionById ?? NO_VALUATIONS,
    recorded: chart?.recorded,
  });
  const showChart = chart != null && series.points.length >= 2;
  const rangeChange = series.baseline && chart?.live
    ? cashFlowAdjustedChange(series.baseline, chart.live)
    : null;
  const scrubChange = scrubbed && series.baseline ? cashFlowAdjustedChange(series.baseline, scrubbed) : null;
  const goalProbability = activeBets.length > 0 ? stats.goalProbability : 0;
  const weightedReturn = activeBets.length > 0 ? stats.weightedReturnPct : 0;
  const isEmpty = activeBets.length === 0 && fallbackCash <= 0;

  return {
    metric,
    setMetric,
    valueView,
    setValueView,
    activeBets,
    rows,
    outcomes,
    breakEvenPosition,
    staked,
    value,
    netPnl,
    netPct,
    positive,
    expectedProfit,
    showExpected,
    projectedValue,
    longestMaturity,
    range,
    setRange,
    scrubbed,
    setScrubbed,
    series,
    showChart,
    rangeChange,
    scrubChange,
    goalProbability,
    weightedReturn,
    isEmpty,
  };
}
