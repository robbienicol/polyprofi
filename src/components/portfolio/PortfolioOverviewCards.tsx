import React from 'react';
import { Pressable, View } from 'react-native';

import { useMoney } from '@/api/hooks/usePreferences';
import { OutcomeRangeBar } from '@/components/portfolio/PortfolioVisuals';
import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { MetricInfo } from '@/components/ui/MetricInfo';
import { Brand, OnBrand, Radius, Semantic, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { MetricKey } from '@/lib/metric-glossary';
import { maturityWords } from '@/lib/portfolio';
import { MONO, signedPct } from '@/lib/portfolio-format';
import type { OutcomeRange } from '@/lib/portfolio-shape';

/**
 * Three scenarios, one axis: the bad run, the average one and the good one,
 * each as what you'd be holding and what that is against what you put in.
 */
export function OutcomeScenariosCard({
  outcomes,
  breakEvenPosition,
  longestMaturity,
}: {
  outcomes: OutcomeRange;
  breakEvenPosition: number | null;
  longestMaturity: number;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      style={{
        borderRadius: Radius.xl,
        backgroundColor: theme.backgroundElevated,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 16,
        gap: 14,
        ...Shadow.card,
      }}>
      <View className="flex-row items-center" style={{ gap: 6 }}>
        <ThemedText style={{ fontSize: 11, fontWeight: '800', color: theme.textTertiary, letterSpacing: 0.5 }}>
          WHERE THIS COULD END UP
        </ThemedText>
        <MetricInfo metric="outcomeRange" />
      </View>
      <View className="flex-row" style={{ gap: 8 }}>
        <Scenario label="Downside" value={outcomes.worst} staked={outcomes.staked} />
        <Scenario label="Expected" value={outcomes.expected} staked={outcomes.staked} align="center" />
        <Scenario label="Upside" value={outcomes.best} staked={outcomes.staked} align="right" />
      </View>
      <OutcomeRangeBar expectedPosition={outcomes.expectedPosition} breakEvenPosition={breakEvenPosition} />
      <ThemedText style={{ fontSize: 11, lineHeight: 15, color: theme.textTertiary }}>
        {longestMaturity > 0 ? `By the time everything pays out, in about ${maturityWords(longestMaturity)}. ` : ''}
        {breakEvenPosition != null ? 'The thin line is what you put in.' : 'No money has moved.'}
      </ThemedText>
    </View>
  );
}

/** One scenario: what you'd hold, and the gain or loss against what went in. */
function Scenario({
  label,
  value,
  staked,
  align = 'left',
}: {
  label: string;
  value: number;
  staked: number;
  align?: 'left' | 'center' | 'right';
}): React.ReactElement {
  const theme = useTheme();
  const money = useMoney();
  const change = value - staked;
  const alignItems = align === 'left' ? 'flex-start' : align === 'center' ? 'center' : 'flex-end';
  return (
    <View className="flex-1" style={{ alignItems, gap: 2 }}>
      <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary }}>{label}</ThemedText>
      <ThemedText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontSize: 18, fontWeight: '800', color: theme.text, ...MONO }}>
        {money(value, { decimals: 0 })}
      </ThemedText>
      {/* Ink, never green or red: these are what-ifs, not money made or lost. */}
      <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.textTertiary, ...MONO }}>
        {money(change, { decimals: 0, signed: true })}
      </ThemedText>
    </View>
  );
}

/** Headline metrics: expected profit and the average pick probability. */
export function HeadlineMetrics({
  hasActive,
  expectedProfit,
  weightedReturn,
  longestMaturity,
  goalProbability,
}: {
  hasActive: boolean;
  expectedProfit: number;
  weightedReturn: number;
  longestMaturity: number;
  goalProbability: number;
}): React.ReactElement {
  const theme = useTheme();
  const money = useMoney();
  return (
    <View className="flex-row" style={{ gap: 12 }}>
      {/* Deliberately NOT red-when-negative. This is a modelled average over
          outcomes, not money anyone has lost: a fairly-priced contract sits near
          zero and dips below it on spread alone, which is ordinary rather than
          alarming. Painting that red made a finance metric read as a warning
          about the portfolio, so it stays in plain text at any sign and the
          caption says what it is instead. */}
      <MetricTile
        label="Expected profit"
        metric="expectedProfit"
        value={money(expectedProfit, { decimals: 0, signed: true })}
        valueColor={theme.text}
        caption={
          !hasActive
            ? 'Nothing working yet'
            : `Average across outcomes · ${signedPct(weightedReturn, 1)}%${
              longestMaturity > 0 ? ` over ${maturityWords(longestMaturity)}` : ''
            }`
        }
      />
      <MetricTile
        label="Avg. pick probability"
        metric="goalProbability"
        value={`${goalProbability.toFixed(0)}%`}
        valueColor={Semantic.positive}
        // Not the chance of reaching the goal itself — see the glossary entry.
        // "To reach $X" here previously implied it was, which is exactly backwards.
        caption="Stake-weighted average across your positions"
        meter={goalProbability / 100}
      />
    </View>
  );
}

function MetricTile({
  label,
  metric,
  value,
  valueColor,
  caption,
  meter,
}: {
  label: string;
  /** Glossary entry for the ⓘ beside the label. Omit for a self-evident number. */
  metric?: MetricKey;
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
      <View className="flex-row items-center" style={{ gap: 6 }}>
        <ThemedText style={{ fontSize: 11, fontWeight: '800', color: theme.textTertiary, letterSpacing: 0.5 }}>
          {label.toUpperCase()}
        </ThemedText>
        {metric ? <MetricInfo metric={metric} /> : null}
      </View>
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

export function EmptyPortfolio({
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
        <Icon glyph="📊" size={26} color={Brand[500]} strokeWidth={1.6} />
      </View>
      <ThemedText style={{ fontSize: 17, fontWeight: '800', color: theme.text }}>{title}</ThemedText>
      <ThemedText className="text-center" style={{ fontSize: 13, lineHeight: 19, color: theme.textSecondary, maxWidth: 260 }}>
        {body}
      </ThemedText>
      <Pressable
        onPress={onFindRoutes}
        className="items-center active:opacity-85"
        style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], paddingVertical: 13, paddingHorizontal: 22, marginTop: 4 }}>
        <ThemedText style={{ fontSize: 14, fontWeight: '800', color: OnBrand }}>Find routes →</ThemedText>
      </Pressable>
    </View>
  );
}
