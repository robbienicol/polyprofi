import React, { useMemo } from 'react';
import { View } from 'react-native';

import { useMoney } from '@/api/hooks/usePreferences';
import { ThemedText } from '@/components/themed-text';
import { MetricInfo } from '@/components/ui/MetricInfo';
import { Radius, RiskScale, Semantic, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { maturityWords } from '@/lib/portfolio';
import type { PositionValuation } from '@/lib/portfolio-progress';
import {
  averageDaysToMaturity,
  capitalSplit,
  cheapestPaths,
  goalContributions,
  goalTimeline,
} from '@/lib/portfolio-shape';
import type { MetricKey } from '@/lib/metric-glossary';
import type { SavingsGoal, TrackedBet } from '@/types/bets';

const MONO = { fontVariant: ['tabular-nums' as const] };

/** Shared card shell, so the four insights below cannot drift apart visually. */
function InsightCard({
  title,
  metric,
  subtitle,
  children,
}: React.PropsWithChildren<{ title: string; metric: MetricKey; subtitle?: string }>): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      style={{
        borderRadius: Radius.xl,
        backgroundColor: theme.backgroundElevated,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 18,
        gap: 14,
        ...Shadow.card,
      }}>
      <View style={{ gap: 4 }}>
        <View className="flex-row items-center" style={{ gap: 7 }}>
          <ThemedText style={{ fontSize: 15, fontWeight: '800', color: theme.text }}>{title}</ThemedText>
          <MetricInfo metric={metric} size={17} />
        </View>
        {subtitle ? (
          <ThemedText style={{ fontSize: 11, lineHeight: 15, color: theme.textTertiary }}>{subtitle}</ThemedText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/**
 * How much of the money can actually disappear.
 *
 * Expected profit says nothing about survivability: two portfolios with the same
 * expectation are not the same bet if one has every dollar on a coin flip. Three
 * bands rather than two, because "at risk" covering both a prediction contract
 * and an index fund would flatten the most important distinction on the screen —
 * one can go to zero, the other has never done so.
 */
export function CapitalSplitCard({ bets }: { bets: TrackedBet[] }): React.ReactElement | null {
  const theme = useTheme();
  const money = useMoney();
  const split = useMemo(() => capitalSplit(bets), [bets]);
  if (split.staked <= 0) return null;

  const bands = [
    {
      key: 'atRisk',
      label: 'Can go to zero',
      hint: 'Predictions and options — the stake is gone if it does not land',
      amount: split.atRisk,
      pct: split.atRiskPct,
      color: RiskScale[4],
    },
    {
      key: 'market',
      label: 'Market exposed',
      hint: 'Stocks and crypto — can fall, but a fall is not a wipeout',
      amount: split.marketExposed,
      pct: split.marketExposedPct,
      color: RiskScale[2],
    },
    {
      key: 'protected',
      label: 'Not market exposed',
      hint: 'Savings and Treasury — the principal is not riding a market',
      amount: split.protectedCapital,
      pct: split.protectedPct,
      color: RiskScale[0],
    },
  ].filter((band) => band.amount > 0);

  return (
    <InsightCard
      title="At risk vs protected"
      metric="capitalAtRisk"
      subtitle={`Of ${money(split.staked, { decimals: 0 })} invested, ${Math.round(split.atRiskPct)}% could be lost outright.`}>
      <View className="flex-row" style={{ height: 12, borderRadius: Radius.pill, overflow: 'hidden', gap: 2 }}>
        {bands.map((band) => (
          <View key={band.key} style={{ flex: Math.max(band.pct, 0.5), backgroundColor: band.color }} />
        ))}
      </View>

      <View style={{ gap: 12 }}>
        {bands.map((band) => (
          <View key={band.key} className="flex-row items-start" style={{ gap: 9 }}>
            <View style={{ width: 9, height: 9, borderRadius: Radius.pill, backgroundColor: band.color, marginTop: 4 }} />
            <View className="flex-1">
              <ThemedText style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{band.label}</ThemedText>
              <ThemedText style={{ fontSize: 11, lineHeight: 15, color: theme.textTertiary, marginTop: 1 }}>
                {band.hint}
              </ThemedText>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <ThemedText style={{ fontSize: 13, fontWeight: '800', color: theme.text, ...MONO }}>
                {money(band.amount, { decimals: 0 })}
              </ThemedText>
              <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, ...MONO }}>
                {band.pct.toFixed(0)}%
              </ThemedText>
            </View>
          </View>
        ))}
      </View>
    </InsightCard>
  );
}

/**
 * Which positions produced the progress.
 *
 * A goal moves on gains, not on the money put in, so this is measured from live
 * valuations rather than from stakes — a large position sitting flat has
 * contributed nothing, and saying otherwise would credit it for existing.
 */
export function GoalContributionCard({
  bets,
  positionById,
}: {
  bets: TrackedBet[];
  positionById?: Record<string, PositionValuation>;
}): React.ReactElement | null {
  const theme = useTheme();
  const money = useMoney();
  const rows = useMemo(
    () => goalContributions(bets, (betId) => positionById?.[betId]?.unrealizedPnl ?? 0),
    [bets, positionById],
  );
  if (rows.length === 0) return null;

  const totalGain = rows.reduce((sum, row) => sum + row.netGain, 0);
  const anyMovement = rows.some((row) => Math.abs(row.netGain) >= 0.005);

  return (
    <InsightCard
      title="What's moving the goal"
      metric="goalContribution"
      subtitle={
        anyMovement
          ? `${money(totalGain, { signed: true })} of gains so far, and where it came from.`
          : 'Nothing has moved yet. Gains show up here as your positions price in.'
      }>
      <View style={{ gap: 12 }}>
        {rows.slice(0, 5).map((row) => {
          const down = row.netGain < 0;
          return (
            <View key={row.id} style={{ gap: 6 }}>
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <ThemedText style={{ fontSize: 14 }}>{row.emoji}</ThemedText>
                <ThemedText
                  style={{ flex: 1, fontSize: 13, fontWeight: '700', color: theme.text }}
                  numberOfLines={1}>
                  {row.label}
                </ThemedText>
                <ThemedText
                  style={{
                    fontSize: 13,
                    fontWeight: '800',
                    color: down ? Semantic.negative : row.netGain > 0 ? Semantic.positive : theme.textSecondary,
                    ...MONO,
                  }}>
                  {money(row.netGain, { signed: true })}
                </ThemedText>
              </View>
              <View
                style={{ height: 6, borderRadius: Radius.pill, backgroundColor: theme.backgroundSelected, overflow: 'hidden' }}>
                {/* Only the winners get a bar. A position that is down has produced no
                    progress, and drawing it a red bar of "contribution" would say the
                    opposite of what the number beside it says. */}
                {row.sharePct > 0 ? (
                  <View
                    style={{
                      width: `${Math.max(row.sharePct, 2)}%`,
                      height: '100%',
                      borderRadius: Radius.pill,
                      backgroundColor: Semantic.positive,
                    }}
                  />
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </InsightCard>
  );
}

/**
 * When the money comes free, against when the goals are due.
 *
 * The two facts were on different screens, so "will these finish in time" was a
 * question you answered from memory. One axis answers it by looking.
 */
export function MaturityTimelineCard({
  bets,
  goals,
}: {
  bets: TrackedBet[];
  goals: SavingsGoal[];
}): React.ReactElement | null {
  const theme = useTheme();
  const money = useMoney();
  const averageDays = useMemo(() => averageDaysToMaturity(bets), [bets]);
  const timeline = useMemo(() => goalTimeline(bets, goals), [bets, goals]);
  if (timeline.positions.length === 0 && timeline.deadlines.length === 0) return null;

  const horizon = timeline.horizonDays;
  // Mapped into an inset band rather than the full 0–100%, because a marker is
  // centred on its position: something due today or at the far horizon would sit
  // half outside the card and read as clipped rather than as early or late.
  const at = (days: number): number => 3 + Math.min(1, Math.max(0, days / horizon)) * 94;
  // A deadline already gone still belongs on the strip — pinned to today, where it
  // reads as "overdue" rather than disappearing off the left edge.
  const overdue = timeline.deadlines.filter((entry) => entry.days < 0);

  return (
    <InsightCard
      title="Time to maturity"
      metric="timeToMaturity"
      subtitle={
        averageDays != null
          ? `Your money is tied up for ${maturityWords(Math.round(averageDays))} on average, weighted by size.`
          : 'None of your positions has a recorded maturity date.'
      }>
      <View style={{ gap: 10 }}>
        {/* Goal deadlines above the axis, positions below it, so the question the
            strip exists to answer — are the dots left of the flags — is one glance. */}
        <View style={{ height: 26, justifyContent: 'flex-end' }}>
          {timeline.deadlines.map((entry) => (
            <View
              key={entry.id}
              style={{ position: 'absolute', left: `${at(Math.max(entry.days, 0))}%`, alignItems: 'center', marginLeft: -9 }}>
              <ThemedText style={{ fontSize: 13 }}>{entry.emoji}</ThemedText>
              <View style={{ width: 1.5, height: 8, backgroundColor: theme.borderStrong }} />
            </View>
          ))}
        </View>

        <View style={{ height: 2, borderRadius: Radius.pill, backgroundColor: theme.border }} />

        <View style={{ height: 20 }}>
          {timeline.positions.map((entry) => (
            <View
              key={entry.id}
              style={{
                position: 'absolute',
                left: `${at(entry.days)}%`,
                top: 3,
                // Sized by stake, so the strip shows where the weight of the portfolio
                // sits rather than treating a $50 position like a $5,000 one.
                width: entry.amount >= 1_000 ? 13 : entry.amount >= 250 ? 10 : 8,
                height: entry.amount >= 1_000 ? 13 : entry.amount >= 250 ? 10 : 8,
                marginLeft: -5,
                borderRadius: Radius.pill,
                backgroundColor: theme.textSecondary,
              }}
            />
          ))}
        </View>

        <View className="flex-row items-center justify-between">
          <ThemedText style={{ fontSize: 10.5, fontWeight: '700', color: theme.textTertiary }}>Today</ThemedText>
          <ThemedText style={{ fontSize: 10.5, fontWeight: '700', color: theme.textTertiary }}>
            {maturityWords(Math.round(horizon))}
          </ThemedText>
        </View>

        {overdue.length > 0 ? (
          <ThemedText style={{ fontSize: 11, lineHeight: 15, color: Semantic.caution }}>
            {overdue.length} goal{overdue.length === 1 ? '' : 's'} past the date set for {overdue.length === 1 ? 'it' : 'them'}, pinned to today.
          </ThemedText>
        ) : null}

        {timeline.positions.length > 0 ? (
          <ThemedText style={{ fontSize: 11, lineHeight: 15, color: theme.textTertiary }}>
            Dots are positions, sized by how much is in them; flags are goal deadlines.
            Soonest to free up: {maturityWords(Math.round(timeline.positions[0].days))} ·{' '}
            {money(timeline.positions[0].amount, { decimals: 0 })}.
          </ThemedText>
        ) : null}
      </View>
    </InsightCard>
  );
}

/**
 * The routes held, ranked by what a dollar of expected profit costs on each.
 *
 * Capital is the constraint people actually hit — not appetite, not ideas — so
 * ranking by efficiency says more about how far the money can get than ranking
 * by payout, which only ever rewards staking more.
 */
export function CheapestPathCard({
  bets,
  conservative,
  remainingToGoal,
}: {
  bets: TrackedBet[];
  conservative: boolean;
  /** What the goals in scope still need. Null when there is no target to close. */
  remainingToGoal: number | null;
}): React.ReactElement | null {
  const theme = useTheme();
  const money = useMoney();
  const paths = useMemo(() => cheapestPaths(bets, conservative), [bets, conservative]);
  if (paths.length === 0) return null;

  const best = paths[0];
  // What closing the gap would cost at the best rate you are already getting. A
  // projection off your own positions, not a recommendation to put that in.
  const costToClose = remainingToGoal != null && remainingToGoal > 0
    ? remainingToGoal * best.costPerDollar
    : null;

  return (
    <InsightCard
      title="Cheapest path to your goal"
      metric="cheapestPath"
      subtitle={
        costToClose != null
          ? `At your best rate, the ${money(remainingToGoal as number, { decimals: 0 })} still needed would take about ${money(costToClose, { decimals: 0 })} invested.`
          : 'What a dollar of expected profit costs on each route you hold.'
      }>
      <View style={{ gap: 12 }}>
        {paths.slice(0, 5).map((path, index) => (
          <View key={path.id} className="flex-row items-center" style={{ gap: 10 }}>
            <ThemedText
              style={{ fontSize: 11, fontWeight: '900', color: theme.textTertiary, width: 14, ...MONO }}>
              {index + 1}
            </ThemedText>
            <ThemedText style={{ fontSize: 14 }}>{path.emoji}</ThemedText>
            <View className="flex-1">
              <ThemedText style={{ fontSize: 13, fontWeight: '700', color: theme.text }} numberOfLines={1}>
                {path.label}
              </ThemedText>
              <ThemedText style={{ fontSize: 11, color: theme.textTertiary, marginTop: 1 }} numberOfLines={1}>
                {money(path.staked, { decimals: 0 })} in ·{' '}
                {path.shape === 'binary'
                  ? 'stake can go to zero'
                  : path.shape === 'protected'
                    ? 'principal not market exposed'
                    : 'market exposed'}
              </ThemedText>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <ThemedText style={{ fontSize: 13, fontWeight: '800', color: theme.text, ...MONO }}>
                {money(path.costPerDollar, { decimals: 2 })}
              </ThemedText>
              <ThemedText style={{ fontSize: 10.5, fontWeight: '700', color: theme.textTertiary }}>
                per $1
              </ThemedText>
            </View>
          </View>
        ))}
      </View>

      {/* Said plainly and next to the ranking, because "cheapest" invites exactly
          one dangerous reading and it is better answered here than in the sheet. */}
      <ThemedText style={{ fontSize: 11, lineHeight: 15, color: theme.textTertiary }}>
        Cheapest is not safest — read each line against what it says can be lost.
      </ThemedText>
    </InsightCard>
  );
}
