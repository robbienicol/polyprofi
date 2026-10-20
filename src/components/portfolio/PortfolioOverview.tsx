import React from 'react';

import type { PortfolioProgressPoint } from '@/api/client/storage';
import { PortfolioAllocationCard } from '@/components/portfolio/PortfolioAllocationCard';
import { EmptyPortfolio, HeadlineMetrics, OutcomeScenariosCard } from '@/components/portfolio/PortfolioOverviewCards';
import { PortfolioPositionList } from '@/components/portfolio/PortfolioPositionList';
import { PortfolioValueHero } from '@/components/portfolio/PortfolioValueHero';
import { usePortfolioOverviewModel } from '@/components/portfolio/usePortfolioOverviewModel';
import type { PositionValuation } from '@/lib/portfolio-progress';
import type { TrackedBet } from '@/types/bets';

/** What the positions are worth right now, measured rather than modelled. */
export interface PortfolioValueNow {
  /** Principal plus current gains and losses, from live prices where they exist. */
  value: number;
  /** Net gains only — the money made, with the principal excluded. */
  netPnl: number;
  /** Positions priced from a live market. */
  livePositions: number;
  /** Positions whose movement is estimated from tracked yield rather than a quote. */
  projectedPositions: number;
}

export interface PortfolioOverviewProps {
  /** Positions in scope: every tracked position, or just one goal's. */
  bets: TrackedBet[];
  /** Cash to model alongside the positions — the last quiz balance, or 0 when unknown. */
  fallbackCash: number;
  /** Portfolio value that would mean "done". Null when there is no target to claim. */
  targetValue: number | null;
  /** Measured value of the positions. Absent while it is still being fetched. */
  valueNow?: PortfolioValueNow;
  /**
   * The value chart. Drawn from each position's market price history, so it is
   * true for whatever set of positions is in scope. `live` is now, as measured;
   * `recorded` is what the app saw while open, used only if no history comes back
   * — pass it only for the whole portfolio, since that is the series it records.
   */
  chart?: { live: PortfolioProgressPoint | null; recorded?: PortfolioProgressPoint[] };
  /**
   * Live valuation per position, when prices have arrived. Without it a row can only
   * report the payout the route was taken for, which is a forecast wearing the colour
   * of a gain — see PositionRow.
   */
  positionById?: Record<string, PositionValuation>;
  onFindRoutes: () => void;
  onOpenPositions: () => void;
  /** Open one position rather than the whole list. Falls back to the list when absent. */
  onOpenPosition?: (betId: string) => void;
  /**
   * Settle a position from here. "Didn't invest" is the third answer and not a
   * courtesy: without it, a route someone tracked and then decided against can only
   * be cleared by claiming it won or lost, and both of those move real money in the
   * numbers above.
   */
  onResolve?: (args: { id: string; status: TrackedBet['status'] }) => void;
  /** Copy for the nothing-tracked-yet state, which differs per goal. */
  emptyTitle?: string;
  emptyBody?: string;
}

/**
 * Value, allocation and positions for a set of tracked positions. Shared by the
 * Portfolio tab (every position) and a goal's own page (one goal's), so the two
 * never drift into showing the same numbers two different ways.
 *
 * The headline is what the positions are worth *now*, from live prices — the same
 * measurement Home shows, so the two screens agree. Expected profit is a separate,
 * labelled figure: it is a probability-weighted average over outcomes, not a value
 * the portfolio will ever print, and summing it into the headline made a modelled
 * number look like a real balance.
 */
export function PortfolioOverview({
  bets,
  fallbackCash,
  targetValue,
  valueNow,
  chart,
  positionById,
  onFindRoutes,
  onOpenPositions,
  onOpenPosition,
  onResolve,
  emptyTitle = 'No portfolio yet',
  emptyBody = 'Set a goal, pick a route, and what it is worth, where it sits, and your probability of hitting the target all show up here.',
}: PortfolioOverviewProps): React.ReactElement {
  const model = usePortfolioOverviewModel({ bets, fallbackCash, valueNow, chart, positionById });
  const { activeBets } = model;

  if (model.isEmpty) {
    return <EmptyPortfolio title={emptyTitle} body={emptyBody} onFindRoutes={onFindRoutes} />;
  }

  return (
    <>
      <PortfolioValueHero model={model} targetValue={targetValue} valueNow={valueNow} />

      {activeBets.length > 0 ? (
        <OutcomeScenariosCard
          outcomes={model.outcomes}
          breakEvenPosition={model.breakEvenPosition}
          longestMaturity={model.longestMaturity}
        />
      ) : null}

      <HeadlineMetrics
        hasActive={activeBets.length > 0}
        expectedProfit={model.expectedProfit}
        weightedReturn={model.weightedReturn}
        longestMaturity={model.longestMaturity}
        goalProbability={model.goalProbability}
      />

      <PortfolioAllocationCard
        rows={model.rows}
        metric={model.metric}
        onMetricChange={model.setMetric}
        hasActive={activeBets.length > 0}
      />

      <PortfolioPositionList
        bets={bets}
        activeBets={activeBets}
        positionById={positionById}
        onFindRoutes={onFindRoutes}
        onOpenPositions={onOpenPositions}
        onOpenPosition={onOpenPosition}
        onResolve={onResolve}
      />
    </>
  );
}
