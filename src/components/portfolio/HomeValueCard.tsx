import React from 'react';
import { View } from 'react-native';

import type { PortfolioProgressPoint } from '@/api/client/storage';
import type { usePortfolioProgress } from '@/api/hooks/usePortfolioProgress';
import { useMoney } from '@/api/hooks/usePreferences';
import {
  PortfolioLineChart,
  PortfolioRange,
  rangeLabel,
} from '@/components/molecules/PortfolioLineChart';
import { MetricInfo } from '@/components/ui/MetricInfo';
import { ThemedText } from '@/components/themed-text';
import { Radius, Semantic, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Bone, Skeleton } from '@/components/ui/loaders';
import { MONO, scrubLabel } from '@/lib/portfolio-format';
import type { ChartSeries } from '@/lib/portfolio-series';

function relativeUpdate(date: Date | null): string {
  if (!date) return 'Waiting for first refresh';
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1_000));
  if (seconds < 15) return 'Updated just now';
  if (seconds < 60) return `Updated ${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `Updated ${minutes}m ago`;
}

/** What the header's status dot says is being tracked, and how it is priced. */
function trackingLabelFor(progress: HomeProgress): string {
  return progress.livePositions > 0 && progress.projectedPositions > 0
    ? `${progress.livePositions} live · ${progress.projectedPositions} projected`
    : progress.livePositions > 0
      ? `${progress.livePositions} live market${progress.livePositions === 1 ? '' : 's'}`
      : progress.projectedPositions > 0
        ? `${progress.projectedPositions} projected position${progress.projectedPositions === 1 ? '' : 's'}`
        : progress.activeCount > 0
          ? `${progress.activeCount} position${progress.activeCount === 1 ? '' : 's'} tracked`
          : 'No positions yet';
}

type HomeProgress = ReturnType<typeof usePortfolioProgress>;

/** Home's tracked-value card: the live value, its change over the range, and the chart. */
export function HomeValueCard({
  progress,
  series,
  range,
  setRange,
  scrubbed,
  setScrubbed,
  headValue,
  change,
  changePct,
  rangeRising,
  firstLoad,
}: {
  progress: HomeProgress;
  series: ChartSeries;
  range: PortfolioRange;
  setRange: (next: PortfolioRange) => void;
  scrubbed: PortfolioProgressPoint | null;
  setScrubbed: (point: PortfolioProgressPoint | null) => void;
  /** The value under the finger while scrubbing, else now. */
  headValue: number;
  change: number;
  changePct: number;
  rangeRising: boolean;
  /** Nothing priced yet and a refresh in flight: the first load, not a refresh. */
  firstLoad: boolean;
}): React.ReactElement {
  const theme = useTheme();
  const money = useMoney();
  const positive = change >= 0;
  const changeColor = positive ? Semantic.positive : Semantic.negative;
  const trackingLabel = trackingLabelFor(progress);

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
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <ThemedText style={{ fontSize: 12, fontWeight: '800', color: theme.textTertiary, letterSpacing: 0.35 }}>
            TRACKED VALUE · LIVE
          </ThemedText>
          <MetricInfo metric="trackedValue" />
        </View>
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <View style={{
            width: 7,
            height: 7,
            borderRadius: Radius.pill,
            backgroundColor: progress.livePositions > 0 ? Semantic.positive : progress.projectedPositions > 0 ? Semantic.caution : theme.textTertiary,
          }} />
          <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary }}>
            {trackingLabel}
          </ThemedText>
        </View>
      </View>

      {!firstLoad ? (
      <ThemedText
        style={{
          fontSize: 40,
          lineHeight: 48,
          fontWeight: '800',
          color: theme.text,
          letterSpacing: -1.4,
          marginTop: 9,
          ...MONO,
        }}>
        {money(headValue)}
      </ThemedText>
      ) : null}
      {firstLoad ? null : (
      <View className="flex-row items-center" style={{ gap: 7, marginTop: 2 }}>
        <ThemedText style={{ fontSize: 14, fontWeight: '800', color: changeColor, ...MONO }}>
          {money(change, { signed: true })} ({positive ? '+' : '−'}{Math.abs(changePct).toFixed(2)}%)
        </ThemedText>
        <ThemedText style={{ fontSize: 12, color: theme.textTertiary }}>
          {scrubbed ? scrubLabel(scrubbed.time) : rangeLabel(range)}
        </ThemedText>
      </View>

      )}

      {/* First prices still on their way: the value and line hold their shape
          as a skeleton instead of showing $0 and a flat line. */}
      {firstLoad ? (
        <Skeleton style={{ gap: 10, marginTop: 9 }}>
          <Bone width="55%" height={40} radius={8} />
          <Bone width="35%" height={14} />
          <Bone height={150} radius={10} />
        </Skeleton>
      ) : (
      <View style={{ marginTop: 10 }}>
        <PortfolioLineChart
          series={series}
          range={range}
          onRangeChange={(next) => {
            setScrubbed(null);
            setRange(next);
          }}
          onScrub={setScrubbed}
          projected={progress.projectedPositions > 0}
          rising={rangeRising}
          surface={theme.backgroundElevated}
          bleed={18}
        />
      </View>
      )}

      <View
        className="flex-row items-center justify-between"
        style={{ borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12, marginTop: 4 }}>
        <ThemedText style={{ fontSize: 11, color: theme.textTertiary }}>
          {progress.isRefreshing ? 'Refreshing market prices…' : relativeUpdate(progress.updatedAt)}
        </ThemedText>
        {progress.projectedPositions > 0 ? (
          <View className="flex-row items-center" style={{ gap: 5 }}>
            <View style={{ width: 6, height: 6, borderRadius: 9, borderWidth: 1, borderColor: Semantic.caution }} />
            <ThemedText style={{ fontSize: 11, color: Semantic.caution }}>includes projected accrual</ThemedText>
            <MetricInfo metric="projectedAccrual" />
          </View>
        ) : null}
      </View>
    </View>
  );
}
