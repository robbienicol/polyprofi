import React from 'react';
import { Pressable, View } from 'react-native';

import { useMoney } from '@/api/hooks/usePreferences';
import { AllocationBar, AllocationDonut, type AllocationRow } from '@/components/portfolio/PortfolioVisuals';
import type { AllocationMetric } from '@/components/portfolio/usePortfolioOverviewModel';
import { ThemedText } from '@/components/themed-text';
import { Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MONO, signedPct } from '@/lib/portfolio-format';

/** Allocation by asset class, as a share of what is invested or as expected return. */
export function PortfolioAllocationCard({
  rows,
  metric,
  onMetricChange,
  hasActive,
}: {
  rows: AllocationRow[];
  metric: AllocationMetric;
  onMetricChange: (next: AllocationMetric) => void;
  hasActive: boolean;
}): React.ReactElement {
  const theme = useTheme();
  const money = useMoney();
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
        <View className="flex-row items-center justify-between" style={{ gap: 10 }}>
          <ThemedText style={{ fontSize: 15, fontWeight: '800', color: theme.text }}>By asset class</ThemedText>
          <Segmented
            options={[
              { value: 'share', label: 'Share' },
              { value: 'return', label: 'Return' },
            ]}
            selected={metric}
            onSelect={onMetricChange}
          />
        </View>
        <ThemedText style={{ fontSize: 11, color: theme.textTertiary }}>
          {metric === 'share'
            ? 'Share of everything you have invested'
            : 'Expected profit contribution, as % of total invested'}
        </ThemedText>
      </View>

      <View className="flex-row items-center" style={{ gap: 18 }}>
        <AllocationDonut
          rows={rows}
          value={money(rows.reduce((sum, row) => sum + row.staked, 0), { decimals: 0 })}
          caption={hasActive ? 'invested' : 'cash'}
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
                    : `${signedPct(row.evPct, 1)}%`}
                </ThemedText>
              </View>
              <AllocationBar
                pct={metric === 'share' ? row.pct : Math.min(Math.abs(row.evPct) * 2, 100)}
                color={row.color}
              />
              <ThemedText style={{ fontSize: 11, color: theme.textTertiary, ...MONO }}>
                {money(row.staked, { decimals: 0 })} staked
              </ThemedText>
            </View>
          ))}
        </View>
      </View>
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
