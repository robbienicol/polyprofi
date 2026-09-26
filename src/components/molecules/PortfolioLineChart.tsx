import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { CHART_RANGES, type ChartRange } from '@/api/client/price-history';
import type { PortfolioProgressPoint } from '@/api/client/storage';
import { ThemedText } from '@/components/themed-text';
import { Semantic } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ChartSeries } from '@/lib/portfolio-series';

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

export type PortfolioRange = ChartRange;
export const RANGE_OPTIONS = CHART_RANGES;

/** How the header names the period the change is measured over. */
export function rangeLabel(range: ChartRange): string {
  switch (range) {
    case '1D': return 'Today';
    case '1W': return 'Past week';
    case '1M': return 'Past month';
    case '3M': return 'Past 3 months';
    case 'YTD': return 'Year to date';
    case '1Y': return 'Past year';
    case 'ALL': return 'All time';
  }
}

/** Whether the range is up from where it was measured, which colours everything. */
export function seriesRising(series: ChartSeries): boolean {
  const last = series.points[series.points.length - 1];
  return !last || !series.baseline || last.value >= series.baseline.value;
}

const PAD_LEFT = 1;
/** Room for the live dot's pulse at the right edge. */
const PAD_RIGHT = 9;
const PAD_Y = 14;
/** Where the scrub cursor sits when there is no scrub: outside the drawn area. */
const PARKED = -100;

/**
 * The portfolio chart, drawn the way a brokerage draws one: every print as a
 * straight segment, no smoothing and no resampling, so the line is exactly as
 * jagged as the market was. No grid, no axis labels — a dotted line at where the
 * range started is the only reference, since "up or down from what?" is the only
 * question the chart answers. On 1D the whole session is laid out and the line
 * walks across it through the day, with pre-market and after-hours drawn fainter.
 */
export function PortfolioLineChart({
  series,
  range,
  onRangeChange,
  onScrub,
  projected = false,
  height = 200,
  surface,
  rising: risingOverride,
  bleed = 0,
}: {
  series: ChartSeries;
  range: ChartRange;
  onRangeChange: (range: ChartRange) => void;
  /** The point under the finger while scrubbing, and null on release. The header reads it. */
  onScrub?: (point: PortfolioProgressPoint | null) => void;
  /** Ring the live dot when part of the value is modelled rather than priced. */
  projected?: boolean;
  height?: number;
  /** The colour behind the chart. Faded spans are painted over with it. */
  surface?: string;
  /**
   * Up or down, when the caller measures it differently from first-vs-last — the
   * header nets out money added mid-range, and the colours should agree with it.
   */
  rising?: boolean;
  /** Let the line run this far past the container on each side, edge to edge. */
  bleed?: number;
}): React.ReactElement {
  const theme = useTheme();
  const background = surface ?? theme.background;
  const [width, setWidth] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);

  const rising = risingOverride ?? seriesRising(series);
  const color = rising ? Semantic.positive : Semantic.negative;

  const chart = useMemo(() => {
    const { points, baseline } = series;
    if (width <= 0 || points.length < 2) return null;

    const plotLeft = PAD_LEFT;
    const plotRight = width - PAD_RIGHT;
    const plotWidth = Math.max(1, plotRight - plotLeft);

    const domain = series.xMode === 'time' && series.domain ? series.domain : null;
    const span = domain ? Math.max(1, domain.end - domain.start) : 1;
    const xOfTime = (time: number) => plotLeft + ((time - (domain?.start ?? 0)) / span) * plotWidth;
    const xs = points.map((point, index) => (domain
      ? Math.min(plotRight, Math.max(plotLeft, xOfTime(point.time)))
      : plotLeft + (index / (points.length - 1)) * plotWidth));

    const values = points.map((point) => point.value);
    if (baseline) values.push(baseline.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    // A flat line sits in the middle rather than on an edge.
    const spread = Math.max(max - min, Math.max(0.01, Math.abs(max) * 0.0005));
    const low = min - spread * 0.06;
    const high = max + spread * 0.06;
    const yOf = (value: number) => PAD_Y + ((high - value) / (high - low)) * (height - PAD_Y * 2);
    const ys = points.map((point) => yOf(point.value));

    let d = '';
    xs.forEach((x, index) => {
      d += `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${ys[index].toFixed(2)}`;
    });

    return {
      d,
      xs,
      ys,
      baselineY: baseline ? yOf(baseline.value) : null,
      faded: domain && series.extendedHours
        ? series.extendedHours.map((spanTime) => {
          // Out to the canvas edge when the span starts or ends the day, so no
          // sliver of the padding is left unfaded.
          const from = spanTime.start <= domain.start ? 0 : xOfTime(spanTime.start);
          const to = spanTime.end >= domain.end ? width : xOfTime(spanTime.end);
          return { x: from, width: Math.max(0, to - from) };
        }).filter((rect) => rect.width > 0)
        : [],
    };
  }, [height, series, width]);

  /* ---------------------------------------------------------------- live dot */

  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1_700, easing: Easing.out(Easing.quad) }), -1, false);
  }, [pulse]);

  const endX = chart ? chart.xs[chart.xs.length - 1] : PARKED;
  const endY = chart ? chart.ys[chart.ys.length - 1] : PARKED;
  const pulseProps = useAnimatedProps(() => ({
    r: 3.5 + pulse.value * 9,
    fillOpacity: 0.32 * (1 - pulse.value),
  }));

  /* ---------------------------------------------------------------- scrubbing */

  const scrubIndex = useSharedValue(-1);
  const xs = useSharedValue<number[]>([]);
  const ys = useSharedValue<number[]>([]);

  useEffect(() => {
    xs.value = chart?.xs ?? [];
    ys.value = chart?.ys ?? [];
  }, [chart, xs, ys]);

  const points = series.points;
  const report = useCallback((index: number) => {
    setScrubbing(index >= 0);
    onScrub?.(index >= 0 ? points[index] ?? null : null);
  }, [onScrub, points]);

  // Runs on the UI thread: the cursor tracks the finger at display rate, and only a
  // change of index crosses to JS to update the header.
  const scrubTo = (x: number) => {
    'worklet';
    const positions = xs.value;
    const count = positions.length;
    if (count === 0) return;
    // Nearest drawn point to the finger. Binary search, because on 1D the points
    // are placed by time and are not evenly spaced.
    let low = 0;
    let high = count - 1;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (positions[mid] < x) low = mid + 1;
      else high = mid;
    }
    const index = low > 0 && Math.abs(positions[low - 1] - x) <= Math.abs(positions[low] - x) ? low - 1 : low;
    if (index === scrubIndex.get()) return;
    scrubIndex.set(index);
    runOnJS(report)(index);
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    // Inside a vertical ScrollView: sideways movement claims the gesture first.
    .activeOffsetX([-2, 2])
    .failOffsetY([-14, 14])
    .onBegin((event) => scrubTo(event.x))
    .onUpdate((event) => scrubTo(event.x))
    .onFinalize(() => {
      scrubIndex.set(-1);
      runOnJS(report)(-1);
    });

  // Parked off-canvas rather than transparent: an animated `opacity` does not reach
  // the DOM on web, so a hidden cursor at 0,0 used to show in the corner.
  const cursorLineProps = useAnimatedProps(() => {
    const index = scrubIndex.value;
    const x = index >= 0 ? xs.value[index] ?? PARKED : PARKED;
    return { x1: x, x2: x };
  });
  const cursorDotProps = useAnimatedProps(() => {
    const index = scrubIndex.value;
    return {
      cx: index >= 0 ? xs.value[index] ?? PARKED : PARKED,
      cy: index >= 0 ? ys.value[index] ?? PARKED : PARKED,
    };
  });
  // Everything after the finger goes quiet, so the part of the line being read is
  // the part still in colour.
  const afterCursorProps = useAnimatedProps(() => {
    const index = scrubIndex.value;
    return { x: index >= 0 ? xs.value[index] ?? 10_000 : 10_000 };
  });

  function handleLayout(event: LayoutChangeEvent) {
    const next = event.nativeEvent.layout.width;
    if (next > 0 && Math.abs(next - width) > 1) setWidth(next);
  }

  return (
    <View style={{ gap: 14 }}>
      <GestureDetector gesture={pan}>
        <View
          onLayout={handleLayout}
          style={{ height, marginHorizontal: -bleed }}
          accessibilityLabel="Portfolio value chart">
          {chart ? (
            <Svg width={width} height={height}>
              {chart.baselineY != null ? (
                <Line
                  x1={0}
                  y1={chart.baselineY}
                  x2={width}
                  y2={chart.baselineY}
                  stroke={theme.textTertiary}
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  // A zero-length dash with a round cap is a dot.
                  strokeDasharray="0.01 5.5"
                />
              ) : null}
              <Path
                d={chart.d}
                fill="none"
                stroke={color}
                strokeWidth={1.9}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {chart.faded.map((rect) => (
                <Rect key={rect.x} x={rect.x} y={0} width={rect.width} height={height} fill={background} opacity={0.5} />
              ))}
              <AnimatedRect animatedProps={afterCursorProps} y={0} width={width} height={height} fill={background} opacity={0.62} />

              {!scrubbing ? (
                <>
                  <AnimatedCircle animatedProps={pulseProps} cx={endX} cy={endY} fill={color} />
                  {projected ? (
                    <Circle cx={endX} cy={endY} r={7.5} fill="none" stroke={Semantic.caution} strokeWidth={1.25} strokeDasharray="2 3" />
                  ) : null}
                  <Circle cx={endX} cy={endY} r={3.5} fill={color} />
                </>
              ) : null}

              <AnimatedLine
                animatedProps={cursorLineProps}
                y1={0}
                y2={height}
                stroke={theme.textSecondary}
                strokeWidth={1}
              />
              <AnimatedCircle animatedProps={cursorDotProps} r={4.5} fill={color} stroke={background} strokeWidth={2} />
            </Svg>
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ThemedText style={{ color: theme.textTertiary, fontSize: 13 }}>
                {series.points.length === 0 ? 'Acquire a route to start your curve' : ' '}
              </ThemedText>
            </View>
          )}
        </View>
      </GestureDetector>

      <View className="flex-row justify-between items-center" accessibilityRole="tablist">
        {RANGE_OPTIONS.map((option) => {
          const active = option === range;
          return (
            <Pressable
              key={option}
              onPress={() => onRangeChange(option)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              hitSlop={6}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 9,
                borderRadius: 9,
                backgroundColor: active ? color : 'transparent',
              }}>
              <ThemedText style={{
                fontSize: 13.5,
                fontWeight: '800',
                color: active ? '#FFFFFF' : color,
              }}>
                {option}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
