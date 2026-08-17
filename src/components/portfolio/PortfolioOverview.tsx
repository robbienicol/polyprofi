import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useMoney, usePreferences } from '@/api/hooks/usePreferences';
import {
  AllocationBar,
  AllocationDonut,
  buildAllocationRows,
  compactAssetClass,
  PerformanceChart,
} from '@/components/portfolio/PortfolioVisuals';
import { ThemedText } from '@/components/themed-text';
import { Accent, Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { portfolioStats } from '@/lib/portfolio';
import type { TrackedBet } from '@/types/bets';

const MONO = { fontVariant: ['tabular-nums' as const] };

type AllocationMetric = 'share' | 'return';

/** Plain-language horizon for the expectation: "3 days", "5 weeks", "4 months". */
function maturityWords(days: number): string {
  if (days <= 1) return 'a day';
  if (days < 14) return `${days} days`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  if (days < 365) return `${Math.round(days / 30)} months`;
  return `${(days / 365).toFixed(1)} years`;
}

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
   * Recorded value history, for the chart. Only the whole-portfolio view has one:
   * history is not kept per goal, and drawing the global series on a single goal
   * would be a lie about that goal.
   */
  historyPoints?: { time: number; value: number }[];
  onFindRoutes: () => void;
  onOpenPositions: () => void;
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
  historyPoints,
  onFindRoutes,
  onOpenPositions,
  emptyTitle = 'No portfolio yet',
  emptyBody = 'Set a goal, pick a route, and what it is worth, where it sits, and your odds of hitting the target all show up here.',
}: PortfolioOverviewProps): React.ReactElement {
  const theme = useTheme();
  const money = useMoney();
  const { preferences, update } = usePreferences();
  const conservative = preferences.conservativeProjections;
  const [metric, setMetric] = useState<AllocationMetric>('share');

  const activeBets = useMemo(() => bets.filter((bet) => bet.status === 'active'), [bets]);
  const stats = useMemo(() => portfolioStats(bets, conservative), [bets, conservative]);
  const rows = useMemo(() => buildAllocationRows(bets, fallbackCash, conservative), [bets, conservative, fallbackCash]);

  const staked = activeBets.reduce((sum, bet) => sum + bet.amountWagered, 0);
  // Falls back to the principal rather than to a modelled figure: before any price
  // arrives, what you put in is the only thing actually known.
  const value = valueNow?.value ?? staked;
  const netPnl = valueNow?.netPnl ?? 0;
  const netPct = staked > 0 ? (netPnl / staked) * 100 : 0;
  const positive = netPnl >= 0;
  const expectedProfit = activeBets.length > 0 ? stats.totalEv : 0;
  // The horizon the expectation belongs to. Without it, a 3-day bet and a 5-month
  // bond get summed into one number with no date attached to it.
  const longestMaturity = activeBets.reduce(
    (longest, bet) => Math.max(longest, bet.maturesInDays ?? 0),
    0,
  );
  const chartPoints = historyPoints && historyPoints.length >= 2 ? historyPoints : null;
  const goalProbability = activeBets.length > 0 ? stats.goalProbability : 0;
  const weightedReturn = activeBets.length > 0 ? stats.weightedReturnPct : 0;
  const isEmpty = activeBets.length === 0 && fallbackCash <= 0;

  if (isEmpty) {
    return <EmptyPortfolio title={emptyTitle} body={emptyBody} onFindRoutes={onFindRoutes} />;
  }

  return (
    <>
      {/* Projected value hero */}
      <View
        style={{
          borderRadius: Radius.xl,
          backgroundColor: theme.backgroundElevated,
          borderWidth: 1,
          borderColor: theme.border,
          paddingHorizontal: 18,
          paddingTop: 18,
          paddingBottom: 14,
          ...Shadow.card,
        }}>
        <View className="flex-row items-center justify-between">
          <ThemedText style={{ fontSize: 11, fontWeight: '800', color: theme.textTertiary, letterSpacing: 0.8 }}>
            WORTH NOW
          </ThemedText>
          <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, ...MONO }}>
            {money(staked, { decimals: 0 })} put in
          </ThemedText>
        </View>

        <ThemedText
          style={{ fontSize: 38, lineHeight: 46, fontWeight: '800', color: theme.text, letterSpacing: -1.3, marginTop: 8, ...MONO }}
          numberOfLines={1}>
          {money(value)}
        </ThemedText>

        <View className="flex-row items-center" style={{ gap: 7, marginTop: 1 }}>
          <ThemedText style={{ fontSize: 14, fontWeight: '800', color: positive ? Brand[500] : Accent.red, ...MONO }}>
            {money(netPnl, { signed: true })} ({positive ? '+' : '−'}{Math.abs(netPct).toFixed(1)}%)
          </ThemedText>
          <ThemedText style={{ fontSize: 12, color: theme.textTertiary }}>
            since you bought in
          </ThemedText>
        </View>

        {/* Real recorded history only. The old chart plotted each position's expected
            future profit against the date it was opened, so the line climbed simply
            because you had opened something. */}
        {chartPoints ? (
          <View style={{ marginTop: 10 }}>
            <PerformanceChart points={chartPoints} />
          </View>
        ) : null}

        <View
          className="flex-row items-center justify-between"
          style={{ borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12, marginTop: 8, gap: 10 }}>
          <ThemedText style={{ fontSize: 11, lineHeight: 15, color: theme.textTertiary, flex: 1 }}>
            {valueNow == null
              ? 'Waiting on prices — showing what you put in.'
              : valueNow.livePositions > 0 && valueNow.projectedPositions > 0
                ? `${valueNow.livePositions} priced live · ${valueNow.projectedPositions} estimated from yield.`
                : valueNow.livePositions > 0
                  ? `${valueNow.livePositions} position${valueNow.livePositions === 1 ? '' : 's'} priced from live markets.`
                  : valueNow.projectedPositions > 0
                    ? 'Estimated from tracked yield and time held.'
                    : 'No live price yet — showing what you put in.'}
          </ThemedText>
          <Pressable
            onPress={() => update({ conservativeProjections: !conservative })}
            accessibilityRole="switch"
            accessibilityState={{ checked: conservative }}
            accessibilityLabel="Conservative projections"
            className="active:opacity-70"
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: Radius.pill,
              borderWidth: 1,
              borderColor: conservative ? Accent.gold + '66' : theme.border,
              backgroundColor: conservative ? Accent.gold + '18' : 'transparent',
            }}>
            <ThemedText
              style={{ fontSize: 11, fontWeight: '800', color: conservative ? Accent.gold : theme.textSecondary }}>
              {conservative ? '🛡 Conservative' : 'Conservative off'}
            </ThemedText>
          </Pressable>
        </View>
      </View>

      {/* Headline metrics */}
      <View className="flex-row" style={{ gap: 12 }}>
        <MetricTile
          label="Expected profit"
          value={money(expectedProfit, { decimals: 0, signed: true })}
          valueColor={expectedProfit >= 0 ? Brand[500] : Accent.red}
          caption={
            activeBets.length === 0
              ? 'Nothing working yet'
              : `${weightedReturn >= 0 ? '+' : '−'}${Math.abs(weightedReturn).toFixed(1)}% on average${
                longestMaturity > 0 ? ` over ${maturityWords(longestMaturity)}` : ''
              }${conservative ? ' · stocks & crypto at 0%' : ''}`
          }
        />
        <MetricTile
          label="Goal probability"
          value={`${goalProbability.toFixed(0)}%`}
          valueColor={Brand[500]}
          caption={
            targetValue != null
              ? `To reach ${money(targetValue, { decimals: 0 })}`
              : 'Stake-weighted average hit rate'
          }
          meter={goalProbability / 100}
        />
      </View>

      {/* Allocation */}
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
          <View className="flex-row items-center justify-between" style={{ gap: 10 }}>
            <ThemedText style={{ fontSize: 15, fontWeight: '800', color: theme.text }}>By asset class</ThemedText>
            <Segmented
              options={[
                { value: 'share', label: 'Share' },
                { value: 'return', label: 'Return' },
              ]}
              selected={metric}
              onSelect={setMetric}
            />
          </View>
          <ThemedText style={{ fontSize: 11, color: theme.textTertiary }}>
            {metric === 'share'
              ? 'Share of everything you have staked'
              : 'Expected profit contribution, as % of total staked'}
          </ThemedText>
        </View>

        <View className="flex-row items-center" style={{ gap: 18 }}>
          <AllocationDonut
            rows={rows}
            value={money(rows.reduce((sum, row) => sum + row.staked, 0), { decimals: 0 })}
            caption={activeBets.length > 0 ? 'staked' : 'cash'}
          />
          <View className="flex-1" style={{ gap: 12 }}>
            {rows.map((row) => (
              <View key={row.category} style={{ gap: 5 }}>
                <View className="flex-row items-center" style={{ gap: 7 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: row.color }} />
                  <ThemedText style={{ flex: 1, fontSize: 13, fontWeight: '700', color: theme.text }} numberOfLines={1}>
                    {row.category}
                  </ThemedText>
                  <ThemedText style={{ fontSize: 13, fontWeight: '700', color: theme.text, ...MONO }}>
                    {metric === 'share'
                      ? `${row.pct.toFixed(0)}%`
                      : `${row.evPct >= 0 ? '+' : '−'}${Math.abs(row.evPct).toFixed(1)}%`}
                  </ThemedText>
                </View>
                <AllocationBar
                  pct={metric === 'share' ? row.pct : Math.min(Math.abs(row.evPct) * 2, 100)}
                  color={metric === 'return' && row.evPct < 0 ? Accent.red : row.color}
                />
                <ThemedText style={{ fontSize: 11, color: theme.textTertiary, ...MONO }}>
                  {money(row.staked, { decimals: 0 })} staked
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Positions */}
      {activeBets.length === 0 ? (
        <Pressable
          onPress={onFindRoutes}
          className="py-4 items-center active:opacity-85"
          style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], ...Shadow.card }}>
          <ThemedText style={{ fontSize: 14, fontWeight: '800', color: '#06140C' }}>
            Put your cash to work →
          </ThemedText>
        </Pressable>
      ) : (
        <View style={{ gap: 10 }}>
          <View className="flex-row items-center justify-between" style={{ paddingHorizontal: 6 }}>
            <ThemedText style={{ fontSize: 11, fontWeight: '800', color: theme.textTertiary, letterSpacing: 0.9 }}>
              ACTIVE POSITIONS
            </ThemedText>
            <Pressable onPress={onOpenPositions} className="active:opacity-60">
              <ThemedText style={{ fontSize: 12, fontWeight: '800', color: Brand[500] }}>Manage →</ThemedText>
            </Pressable>
          </View>

          {activeBets.slice(0, 5).map((bet) => (
            <Pressable
              key={bet.id}
              onPress={onOpenPositions}
              className="active:opacity-80"
              style={{
                borderRadius: Radius.lg,
                backgroundColor: theme.backgroundElement,
                borderWidth: 1,
                borderColor: theme.border,
                paddingHorizontal: 14,
                paddingVertical: 13,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: Radius.sm,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.backgroundSelected,
                }}>
                <ThemedText style={{ fontSize: 17 }}>{bet.emoji}</ThemedText>
              </View>
              <View className="flex-1" style={{ gap: 2 }}>
                <ThemedText style={{ fontSize: 14, fontWeight: '700', color: theme.text }} numberOfLines={1}>
                  {bet.description}
                </ThemedText>
                <ThemedText style={{ fontSize: 11, color: theme.textTertiary }} numberOfLines={1}>
                  {positionMeta(bet.category, bet.platform, bet.probability)}
                </ThemedText>
              </View>
              <View className="items-end" style={{ gap: 2 }}>
                <ThemedText style={{ fontSize: 14, fontWeight: '800', color: theme.text, ...MONO }}>
                  {money(bet.amountWagered, { decimals: 0 })}
                </ThemedText>
                <ThemedText style={{ fontSize: 11, fontWeight: '700', color: Brand[500], ...MONO }}>
                  {money(bet.expectedReturn, { decimals: 0, signed: true })}
                </ThemedText>
              </View>
            </Pressable>
          ))}

          {activeBets.length > 5 ? (
            <Pressable onPress={onOpenPositions} className="items-center py-2 active:opacity-60">
              <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary }}>
                View all {activeBets.length} positions
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      )}
    </>
  );
}

/** "Stocks · Robinhood · 71% chance", minus the class when it just repeats the venue. */
function positionMeta(category: string, platform: string, probability: number): string {
  const assetClass = compactAssetClass(category);
  const parts = assetClass.toLowerCase() === platform.toLowerCase() ? [platform] : [assetClass, platform];
  return [...parts, `${probability}% chance`].join(' · ');
}

function MetricTile({
  label,
  value,
  valueColor,
  caption,
  meter,
}: {
  label: string;
  value: string;
  valueColor: string;
  caption: string;
  /** 0–1; draws a thin fill bar under the value when provided. */
  meter?: number;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      className="flex-1"
      style={{
        borderRadius: Radius.lg,
        backgroundColor: theme.backgroundElevated,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 14,
        gap: 6,
        ...Shadow.card,
      }}>
      <ThemedText style={{ fontSize: 11, fontWeight: '800', color: theme.textTertiary, letterSpacing: 0.5 }}>
        {label.toUpperCase()}
      </ThemedText>
      <ThemedText style={{ fontSize: 28, fontWeight: '800', color: valueColor, letterSpacing: -0.6, ...MONO }} numberOfLines={1}>
        {value}
      </ThemedText>
      {meter != null ? (
        <View style={{ height: 4, borderRadius: Radius.pill, backgroundColor: theme.backgroundSelected, overflow: 'hidden' }}>
          <View
            style={{
              width: `${Math.max(Math.min(meter * 100, 100), 2)}%`,
              height: '100%',
              borderRadius: Radius.pill,
              backgroundColor: valueColor,
            }}
          />
        </View>
      ) : null}
      <ThemedText style={{ fontSize: 11, lineHeight: 15, color: theme.textSecondary }}>{caption}</ThemedText>
    </View>
  );
}

function Segmented<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: readonly { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      className="flex-row"
      style={{ padding: 2, borderRadius: Radius.pill, backgroundColor: theme.backgroundSelected, gap: 2 }}>
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{
              paddingHorizontal: 11,
              paddingVertical: 5,
              borderRadius: Radius.pill,
              backgroundColor: active ? theme.backgroundElevated : 'transparent',
            }}>
            <ThemedText
              style={{ fontSize: 11, fontWeight: '800', color: active ? theme.text : theme.textTertiary }}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function EmptyPortfolio({
  title,
  body,
  onFindRoutes,
}: {
  title: string;
  body: string;
  onFindRoutes: () => void;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      className="items-center"
      style={{
        borderRadius: Radius.xl,
        backgroundColor: theme.backgroundElevated,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 24,
        gap: 12,
        ...Shadow.card,
      }}>
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: Radius.xl,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: Brand[500] + '18',
        }}>
        <ThemedText style={{ fontSize: 28 }}>📊</ThemedText>
      </View>
      <ThemedText style={{ fontSize: 17, fontWeight: '800', color: theme.text }}>{title}</ThemedText>
      <ThemedText className="text-center" style={{ fontSize: 13, lineHeight: 19, color: theme.textSecondary, maxWidth: 260 }}>
        {body}
      </ThemedText>
      <Pressable
        onPress={onFindRoutes}
        className="items-center active:opacity-85"
        style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], paddingVertical: 13, paddingHorizontal: 22, marginTop: 4 }}>
        <ThemedText style={{ fontSize: 14, fontWeight: '800', color: '#06140C' }}>Find routes →</ThemedText>
      </Pressable>
    </View>
  );
}
