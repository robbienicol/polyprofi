import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { PortfolioProgressPoint } from '@/api/client/storage';
import { ThemedText } from '@/components/themed-text';
import { Accent, Brand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PortfolioRange = '1D' | '1W' | '1M' | 'ALL';

const RANGE_MS: Record<Exclude<PortfolioRange, 'ALL'>, number> = {
  '1D': 24 * 60 * 60 * 1_000,
  '1W': 7 * 24 * 60 * 60 * 1_000,
  '1M': 30 * 24 * 60 * 60 * 1_000,
};

function pointsForRange(points: PortfolioProgressPoint[], range: PortfolioRange) {
  if (range === 'ALL' || points.length < 2) return points;
  const cutoff = points[points.length - 1].time - RANGE_MS[range];
  const firstInRange = points.findIndex((point) => point.time >= cutoff);
  if (firstInRange <= 0) return firstInRange === -1 ? points.slice(-1) : points;
  return points.slice(firstInRange - 1);
}

function downsample(points: PortfolioProgressPoint[], maxPoints = 140) {
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, index) => points[Math.round(index * step)]);
}

export function PortfolioLineChart({
  points,
  range,
  onRangeChange,
  projected,
}: {
  points: PortfolioProgressPoint[];
  range: PortfolioRange;
  onRangeChange: (range: PortfolioRange) => void;
  projected: boolean;
}): React.ReactElement {
  const theme = useTheme();
  const [width, setWidth] = useState(340);
  const height = 190;
  const padX = 5;
  const padY = 18;

  const chart = useMemo(() => {
    const visible = downsample(pointsForRange(points, range));
    if (visible.length === 0) return null;

    const firstTime = visible[0].time;
    const lastTime = visible[visible.length - 1].time;
    const timeRange = Math.max(1, lastTime - firstTime);
    const values = visible.map((point) => point.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const rawRange = maxValue - minValue;
    const valuePad = Math.max(1, rawRange * 0.14, maxValue * 0.002);
    const low = minValue - valuePad;
    const valueRange = Math.max(1, maxValue + valuePad - low);

    const normalized = visible.map((point) => ({
      x: padX + ((point.time - firstTime) / timeRange) * (width - padX * 2),
      y: padY + (1 - (point.value - low) / valueRange) * (height - padY * 2),
    }));
    const line = normalized.map((point, index) =>
      `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    ).join(' ');
    const first = normalized[0];
    const last = normalized[normalized.length - 1];
    const area = `${line} L ${last.x.toFixed(2)} ${height} L ${first.x.toFixed(2)} ${height} Z`;
    return { line, area, last, rising: visible[visible.length - 1].value >= visible[0].value };
  }, [points, range, width]);

  const lineColor = chart?.rising === false ? Accent.red : Brand[500];

  function handleLayout(event: LayoutChangeEvent) {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0 && Math.abs(nextWidth - width) > 1) setWidth(nextWidth);
  }

  return (
    <View style={{ gap: 12 }}>
      <View
        onLayout={handleLayout}
        style={{ height, width: '100%' }}
        accessibilityLabel="Portfolio value history chart">
        {chart ? (
          <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            <Defs>
              <LinearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={lineColor} stopOpacity={0.2} />
                <Stop offset="0.72" stopColor={lineColor} stopOpacity={0.035} />
                <Stop offset="1" stopColor={lineColor} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={chart.area} fill="url(#portfolioFill)" />
            <Path
              d={chart.line}
              fill="none"
              stroke={lineColor}
              strokeWidth={2.75}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {projected ? (
              <Circle
                cx={chart.last.x}
                cy={chart.last.y}
                r={8}
                fill="none"
                stroke={Accent.gold}
                strokeWidth={1.25}
                strokeDasharray="2 3"
              />
            ) : null}
            <Circle cx={chart.last.x} cy={chart.last.y} r={6} fill={lineColor} opacity={0.16} />
            <Circle cx={chart.last.x} cy={chart.last.y} r={3.25} fill={lineColor} />
          </Svg>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ThemedText style={{ color: theme.textTertiary, fontSize: 13 }}>
              Track a route to start your curve
            </ThemedText>
          </View>
        )}
      </View>

      <View className="flex-row justify-between" accessibilityRole="tablist">
        {(['1D', '1W', '1M', 'ALL'] as const).map((option) => {
          const active = option === range;
          return (
            <Pressable
              key={option}
              onPress={() => onRangeChange(option)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              hitSlop={8}
              style={{
                minWidth: 52,
                paddingHorizontal: 14,
                paddingVertical: 8,
                alignItems: 'center',
                borderRadius: Radius.pill,
                backgroundColor: active ? Brand[500] + '22' : 'transparent',
              }}>
              <ThemedText style={{
                fontSize: 12,
                fontWeight: '800',
                color: active ? Brand[500] : theme.textTertiary,
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
