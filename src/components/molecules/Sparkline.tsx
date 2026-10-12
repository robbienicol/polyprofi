import { ArrowDown, ArrowUp, Minus } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { Semantic } from '@/constants/theme';
import { useChartColor, useSemanticText, useTheme } from '@/hooks/use-theme';
import type { RouteLive } from '@/api/hooks/useRouteLive';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const MONO = { fontVariant: ['tabular-nums' as const] };

/** Room for the live dot's pulse at the right edge. */
const PAD_RIGHT = 8;
const PAD_Y = 6;

/**
 * A route's line as the market printed it — no smoothing, so it is exactly as jagged
 * as the price was — with a dotted line at where the window started and a pulsing dot
 * on the latest print. One neutral hue whichever way it went: the line is a fact,
 * not a verdict.
 *
 * The first time it has data it draws itself in, left to right, with the fill rising
 * behind the line and the live dot landing at the end. Later ticks just update.
 */
export function Sparkline({ live, height = 44, strokeWidth = 1.75 }: { live: RouteLive; height?: number; strokeWidth?: number }) {
  const [width, setWidth] = useState(0);
  const { prices, times } = live.series;
  const color = useChartColor().line;
  const gradientId = 'spark-fill';

  const chart = useMemo(() => {
    if (width <= 0 || prices.length < 2) return null;
    const lo = Math.min(...prices, live.baseline);
    const hi = Math.max(...prices, live.baseline);
    const span = hi - lo || 1;
    const drawW = width - PAD_RIGHT;
    // By time, not by index: with only the moves kept, equal spacing would stretch
    // a quiet day as wide as a busy hour.
    const t0 = times[0];
    const tSpan = times[times.length - 1] - t0 || 1;
    const x = (index: number) => ((times[index] - t0) / tSpan) * drawW;
    const y = (value: number) => PAD_Y + (1 - (value - lo) / span) * (height - PAD_Y * 2);
    const xs = prices.map((_, index) => x(index));
    const ys = prices.map(y);
    const points = xs.map((px, index) => `${px.toFixed(1)},${ys[index].toFixed(1)}`);
    const line = `M${points.join('L')}`;
    let length = 0;
    for (let index = 1; index < xs.length; index += 1) {
      length += Math.hypot(xs[index] - xs[index - 1], ys[index] - ys[index - 1]);
    }
    return {
      line,
      length: Math.ceil(length) + 1,
      area: `${line}L${drawW.toFixed(1)},${height}L0,${height}Z`,
      baseY: y(live.baseline),
      endX: x(prices.length - 1),
      endY: y(prices[prices.length - 1]),
      drawW,
    };
  }, [height, live.baseline, prices, times, width]);

  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1_600, easing: Easing.out(Easing.quad) }), -1, false);
  }, [pulse]);
  // 0 → 1 once, the first time there is a line to draw.
  const draw = useSharedValue(0);
  const drawn = useRef(false);
  const ready = chart != null;
  useEffect(() => {
    if (!ready || drawn.current) return;
    drawn.current = true;
    draw.value = withTiming(1, { duration: 1_400, easing: Easing.out(Easing.cubic) });
  }, [draw, ready]);
  const length = chart?.length ?? 0;
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - draw.value) }));
  const areaProps = useAnimatedProps(() => ({ opacity: draw.value * draw.value }));
  const dotProps = useAnimatedProps(() => ({ opacity: draw.value > 0.95 ? (draw.value - 0.95) * 20 : 0 }));

  const pulseProps = useAnimatedProps(() => ({
    r: 3 + pulse.value * 8,
    fillOpacity: draw.value > 0.95 ? 0.35 * (1 - pulse.value) : 0,
  }));

  return (
    <View
      style={{ height }}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      accessible={false}
      importantForAccessibility="no-hide-descendants">
      {chart ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.22} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <AnimatedPath animatedProps={areaProps} d={chart.area} fill={`url(#${gradientId})`} />
          <Line
            x1={0}
            x2={chart.drawW}
            y1={chart.baseY}
            y2={chart.baseY}
            stroke={color}
            strokeOpacity={0.45}
            strokeWidth={1.25}
            strokeLinecap="round"
            strokeDasharray="0.01 4.5"
          />
          <AnimatedPath
            animatedProps={lineProps}
            d={chart.line}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={[chart.length, chart.length]}
          />
          <AnimatedCircle animatedProps={pulseProps} cx={chart.endX} cy={chart.endY} fill={color} />
          <AnimatedCircle animatedProps={dotProps} cx={chart.endX} cy={chart.endY} r={strokeWidth + 1.5} fill={color} />
        </Svg>
      ) : null}
    </View>
  );
}

function formatPrice(live: RouteLive): string {
  if (live.kind === 'outcome') return `${(live.last * 100).toFixed(1)}¢`;
  const digits = live.last >= 1_000 ? 0 : live.last >= 1 ? 2 : 4;
  return `$${live.last.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function formatChange(live: RouteLive): string {
  const sign = live.last >= live.baseline ? '+' : '−';
  const move = live.kind === 'outcome'
    ? Math.abs((live.last - live.baseline) * 100).toFixed(1)
    : Math.abs(((live.last - live.baseline) / live.baseline) * 100).toFixed(2);
  if (Number(move) === 0) return 'unch';
  return live.kind === 'outcome' ? `${sign}${move}¢` : `${sign}${move}%`;
}

/**
 * The latest print and its move over the window, as an arrow chip and a figure.
 * Flashes on each new tick, the way a quote board does — only on a real change,
 * never on a timer.
 */
export function LiveQuote({ live, showPrice = true }: { live: RouteLive; showPrice?: boolean }) {
  const theme = useTheme();
  const change = formatChange(live);
  const flat = change === 'unch';
  const rising = live.last >= live.baseline;
  const previous = useRef(live.last);
  const flash = useSharedValue(0);

  useEffect(() => {
    if (live.last === previous.current) return;
    previous.current = live.last;
    flash.value = withSequence(withTiming(1, { duration: 120 }), withTiming(0, { duration: 900 }));
  }, [flash, live.last]);

  const chart = useChartColor();
  const tickColor = chart.line;
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  // The move is said in the arrow and the sign, in the chart's own hue — not in a
  // green or red that would call it good or bad.
  const fill = flat ? theme.textSecondary : chart.line;
  const color = flat ? theme.textSecondary : chart.ink;

  return (
    <View className="flex-row items-center" style={{ gap: 6 }}>
      <View style={{ width: 20, height: 20, borderRadius: 5, backgroundColor: fill + '24', alignItems: 'center', justifyContent: 'center' }}>
        <Icon icon={flat ? Minus : rising ? ArrowUp : ArrowDown} size={13} color={color} strokeWidth={2.75} />
      </View>
      <View style={{ borderRadius: 5, paddingHorizontal: 3, overflow: 'hidden', flexShrink: 1 }}>
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: tickColor + '33' }, flashStyle]}
        />
        <ThemedText style={{ fontSize: 13, fontWeight: '700', color, ...MONO }} numberOfLines={1}>
          {showPrice && live.kind === 'outcome' ? `${formatPrice(live)} · ` : ''}{change} <ThemedText style={{ fontSize: 11, fontWeight: '600', color: theme.textTertiary }}>{live.window}</ThemedText>
        </ThemedText>
      </View>
    </View>
  );
}

/**
 * A blinking red dot and LIVE, the way a broadcast or a market board marks a feed
 * that is updating. Only ever shown over a real feed — never as decoration.
 */
export function LiveBadge() {
  const ink = useSemanticText();
  const blink = useSharedValue(1);
  useEffect(() => {
    blink.value = withRepeat(withSequence(withTiming(0.25, { duration: 700 }), withTiming(1, { duration: 700 })), -1, false);
  }, [blink]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: blink.value }));
  return (
    <View
      className="flex-row items-center"
      accessibilityLabel="Live price"
      style={{ gap: 5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: Semantic.negative + '14' }}>
      <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: Semantic.negative }, dotStyle]} />
      <ThemedText style={{ fontSize: 10, fontWeight: '900', letterSpacing: 0.8, color: ink.negative }}>LIVE</ThemedText>
    </View>
  );
}

/** Where a live line will be, while its first prints load: a faint pulsing baseline. */
export function SparklinePlaceholder({ height = 44 }: { height?: number }) {
  const theme = useTheme();
  const fade = useSharedValue(0.35);
  useEffect(() => {
    fade.value = withRepeat(withTiming(0.9, { duration: 800 }), -1, true);
  }, [fade]);
  const style = useAnimatedStyle(() => ({ opacity: fade.value }));
  return (
    <Animated.View style={[{ height, justifyContent: 'center' }, style]} accessible={false}>
      <View style={{ height: 2, borderRadius: 1, backgroundColor: theme.border }} />
    </Animated.View>
  );
}
