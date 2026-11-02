import React from 'react';
import { Pressable, View } from 'react-native';

import { useMoney } from '@/api/hooks/usePreferences';
import { PortfolioLineChart, rangeLabel } from '@/components/molecules/PortfolioLineChart';
import type { PortfolioValueNow } from '@/components/portfolio/PortfolioOverview';
import type { PortfolioOverviewModel, ValueView } from '@/components/portfolio/usePortfolioOverviewModel';
import { ThemedText } from '@/components/themed-text';
import { Radius, Semantic, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { maturityWords } from '@/lib/portfolio';
import { MONO, scrubLabel, signedPct } from '@/lib/portfolio-format';

/**
 * Two-segment switch for the hero figure. Doubles as the hero's label, so the
 * number is always named by whichever segment is active.
 *
 * It switches the return under the number as well as the number itself, which is
 * what most people come here to compare — so the segments are named for the state
 * they show ("current", "expected") rather than for the value alone, and the line
 * beneath says the word "return" in both.
 */
function ValueViewToggle({
  value,
  onChange,
}: {
  value: ValueView;
  onChange: (next: ValueView) => void;
}): React.ReactElement {
  const theme = useTheme();
  const segments: { key: ValueView; label: string; hint: string }[] = [
    { key: 'now', label: 'CURRENT', hint: 'what your positions are worth now, and the return so far' },
    { key: 'expected', label: 'EXPECTED', hint: 'the probability-weighted outcome, and the return it implies' },
  ];
  return (
    <View
      className="flex-row"
      style={{ borderRadius: Radius.pill, backgroundColor: theme.backgroundSelected, padding: 2 }}>
      {segments.map((segment) => {
        const active = segment.key === value;
        return (
          <Pressable
            key={segment.key}
            onPress={() => onChange(segment.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityHint={segment.hint}
            hitSlop={6}
            className="active:opacity-70"
            style={{
              borderRadius: Radius.pill,
              paddingHorizontal: 12,
              paddingVertical: 7,
              backgroundColor: active ? theme.backgroundElevated : 'transparent',
            }}>
            <ThemedText
              style={{
                fontSize: 10.5,
                fontWeight: '800',
                letterSpacing: 0.7,
                color: active ? theme.text : theme.textTertiary,
              }}>
              {segment.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** How the hero's value was measured, in one line under it. */
function pricingNote(valueNow: PortfolioValueNow | undefined): string {
  if (valueNow == null) return 'Waiting on prices — showing what you put in.';
  if (valueNow.livePositions > 0 && valueNow.projectedPositions > 0) {
    return `${valueNow.livePositions} priced live · ${valueNow.projectedPositions} estimated from yield.`;
  }
  if (valueNow.livePositions > 0) {
    return `${valueNow.livePositions} position${valueNow.livePositions === 1 ? '' : 's'} priced from live markets.`;
  }
  if (valueNow.projectedPositions > 0) return 'Estimated from tracked yield and time held.';
  return 'No live price yet — showing what you put in.';
}

/** Projected value hero: the headline figure, its return, and the value chart. */
export function PortfolioValueHero({
  model,
  targetValue,
  valueNow,
}: {
  model: PortfolioOverviewModel;
  targetValue: number | null;
  valueNow?: PortfolioValueNow;
}): React.ReactElement {
  const theme = useTheme();
  const money = useMoney();
  const {
    valueView, setValueView, staked, showExpected, projectedValue, scrubbed, value, scrubChange,
    positive, expectedProfit, netPnl, weightedReturn, netPct, longestMaturity, showChart, series,
    range, setRange, setScrubbed, rangeChange,
  } = model;

  return (
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
      <View className="flex-row items-center justify-between" style={{ gap: 10 }}>
        <ValueViewToggle value={valueView} onChange={setValueView} />
        <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, ...MONO }}>
          {money(staked, { decimals: 0 })} put in
        </ThemedText>
      </View>

      <ThemedText
        style={{ fontSize: 38, lineHeight: 46, fontWeight: '800', color: theme.text, letterSpacing: -1.3, marginTop: 8, ...MONO }}
        numberOfLines={1}>
        {money(showExpected ? projectedValue : scrubbed?.value ?? value)}
      </ThemedText>

      {/* The one genuinely cumulative number here: what's in plus what your goals
          still need, versus what you're actually worth right now. Distinct from
          "Avg. pick probability" below, which is a per-position average and was
          wrongly captioned with this same target before. */}
      {targetValue != null && targetValue > 0 && (
        <ThemedText style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
          {money(value, { decimals: 0 })} of {money(targetValue, { decimals: 0 })} goal
          {' · '}
          {Math.min(100, Math.max(0, (value / targetValue) * 100)).toFixed(0)}%
        </ThemedText>
      )}

      {scrubChange && !showExpected ? (
        <View className="flex-row items-center" style={{ gap: 7, marginTop: 1 }}>
          <ThemedText style={{ fontSize: 14, fontWeight: '800', color: scrubChange.amount >= 0 ? Semantic.positive : Semantic.negative, ...MONO }}>
            {money(scrubChange.amount, { signed: true })} ({signedPct(scrubChange.percent, 2)}%)
          </ThemedText>
          <ThemedText style={{ fontSize: 12, color: theme.textTertiary }}>
            {scrubLabel(scrubbed!.time)}
          </ThemedText>
        </View>
      ) : (
        <View className="flex-row items-center" style={{ gap: 7, marginTop: 1 }}>
          <ThemedText
            style={{
              fontSize: 14,
              fontWeight: '800',
              // Red stays for the real P&L view — that is money actually down.
              // The expected view is a model average, so it never goes red: a
              // fairly-priced book sits near zero and crosses it on spread alone.
              color: showExpected ? theme.text : positive ? Semantic.positive : Semantic.negative,
              ...MONO,
            }}>
            {money(showExpected ? expectedProfit : netPnl, { signed: true })} (
            {signedPct(showExpected ? weightedReturn : netPct, 1)}%)
          </ThemedText>
          <ThemedText style={{ fontSize: 12, color: theme.textTertiary }}>
            {showExpected
              ? longestMaturity > 0
                ? `expected return over ${maturityWords(longestMaturity)}`
                : 'expected return, probability-weighted'
              : 'return since you bought in'}
          </ThemedText>
        </View>
      )}

      {/* Market price history of what is held — never the expected future profit
          plotted against the date a position was opened, which climbed simply
          because you had opened something. */}
      {showChart ? (
        <View style={{ marginTop: 12 }}>
          <PortfolioLineChart
            series={series}
            range={range}
            onRangeChange={(next) => {
              setScrubbed(null);
              setRange(next);
            }}
            onScrub={setScrubbed}
            projected={(valueNow?.projectedPositions ?? 0) > 0}
            rising={rangeChange ? rangeChange.amount >= 0 : undefined}
            surface={theme.backgroundElevated}
            bleed={18}
          />
          <ThemedText style={{ fontSize: 11, color: theme.textTertiary, marginTop: 8 }}>
            {rangeChange
              ? `${money(rangeChange.amount, { signed: true })} (${signedPct(rangeChange.percent, 2)}%) ${rangeLabel(range).toLowerCase()}`
              : rangeLabel(range)}
          </ThemedText>
        </View>
      ) : null}

      <View
        className="flex-row items-center justify-between"
        style={{ borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12, marginTop: 8, gap: 10 }}>
        <ThemedText style={{ fontSize: 11, lineHeight: 15, color: theme.textTertiary, flex: 1 }}>
          {pricingNote(valueNow)}
        </ThemedText>
      </View>
    </View>
  );
}
