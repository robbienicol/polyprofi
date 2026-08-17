import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useMoney, usePreferences } from '@/api/hooks/usePreferences';
import {
  AllocationBar,
  AllocationDonut,
  buildAllocationRows,
  buildEquitySeries,
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

export interface PortfolioOverviewProps {
  /** Positions in scope: every tracked position, or just one goal's. */
  bets: TrackedBet[];
  /** Cash to model alongside the positions — the last quiz balance, or 0 when unknown. */
  fallbackCash: number;
  /** Portfolio value that would mean "done". Null when there is no target to claim. */
  targetValue: number | null;
  onFindRoutes: () => void;
  onOpenPositions: () => void;
  /** Copy for the nothing-tracked-yet state, which differs per goal. */
  emptyTitle?: string;
  emptyBody?: string;
}

/**
 * Projected value, allocation and positions for a set of tracked positions.
 * Shared by the Portfolio tab (every position) and the Goals tab (one goal's),
 * so the two never drift into showing the same numbers two different ways.
 */
export function PortfolioOverview({
  bets,
  fallbackCash,
  targetValue,
  onFindRoutes,
  onOpenPositions,
  emptyTitle = 'No portfolio yet',
  emptyBody = 'Set a goal, pick a route, and your allocation, projected value, and odds of hitting the target all show up here.',
}: PortfolioOverviewProps): React.ReactElement {
  const theme = useTheme();
  const money = useMoney();
  const { preferences, update } = usePreferences();
  const conservative = preferences.conservativeProjections;
  const [metric, setMetric] = useState<AllocationMetric>('share');

  const activeBets = useMemo(() => bets.filter((bet) => bet.status === 'active'), [bets]);
  const stats = useMemo(() => portfolioStats(bets, conservative), [bets, conservative]);
  const rows = useMemo(() => buildAllocationRows(bets, fallbackCash, conservative), [bets, conservative, fallbackCash]);
  const equity = useMemo(() => buildEquitySeries(bets, fallbackCash, conservative), [bets, conservative, fallbackCash]);

  const staked = activeBets.reduce((sum, bet) => sum + bet.amountWagered, 0);
  const projectedValue = equity.at(-1)?.value ?? staked;
  const startingValue = equity[0]?.value ?? projectedValue;
  const change = projectedValue - startingValue;
  const changePct = startingValue > 0 ? (change / startingValue) * 100 : 0;
  const positive = change >= 0;
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
            PROJECTED VALUE
          </ThemedText>
          <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, ...MONO }}>
            {money(staked, { decimals: 0 })} staked
          </ThemedText>
        </View>

        <ThemedText
          style={{ fontSize: 38, lineHeight: 46, fontWeight: '800', color: theme.text, letterSpacing: -1.3, marginTop: 8, ...MONO }}
          numberOfLines={1}>
          {money(projectedValue)}
        </ThemedText>

        <View className="flex-row items-center" style={{ gap: 7, marginTop: 1 }}>
          <ThemedText style={{ fontSize: 14, fontWeight: '800', color: positive ? Brand[500] : Accent.red, ...MONO }}>
            {money(change, { signed: true })} ({positive ? '+' : '−'}{Math.abs(changePct).toFixed(1)}%)
          </ThemedText>
          <ThemedText style={{ fontSize: 12, color: theme.textTertiary }}>expected</ThemedText>
        </View>

        <View style={{ marginTop: 10 }}>
          <PerformanceChart points={equity} />
        </View>

        <View
          className="flex-row items-center justify-between"
          style={{ borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12, marginTop: 8, gap: 10 }}>
          <ThemedText style={{ fontSize: 11, lineHeight: 15, color: theme.textTertiary, flex: 1 }}>
            Modelled from expected value — not a guarantee.
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
          label="Weighted return"
          value={`${weightedReturn < 0 ? '−' : ''}${Math.abs(weightedReturn).toFixed(1)}%`}
          valueColor={weightedReturn >= 0 ? Brand[500] : Accent.red}
          caption={conservative ? 'Stocks & crypto counted at 0%' : 'Across every active position'}
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
