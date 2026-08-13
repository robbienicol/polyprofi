import { useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Accent, Brand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { betEv } from '@/lib/portfolio';
import type { TrackedBet } from '@/types/bets';

const CLASS_COLORS = {
  Polymarket: Brand[500],
  Treasuries: '#84CC16',
  Options: Accent.gold,
  Stocks: '#2DD4BF',
  Crypto: '#F97316',
  Cash: '#94A3B8',
  Other: '#A78BFA',
} as const;

type PortfolioClass = keyof typeof CLASS_COLORS;
export type AllocationRow = ReturnType<typeof buildAllocationRows>[number];
export type EquityPoint = ReturnType<typeof buildEquitySeries>[number];

export function compactAssetClass(category: string): string {
  return category === 'Stocks & ETFs' ? 'Stocks' : assetClassFor(category);
}

export function buildAllocationRows(bets: TrackedBet[], fallbackCash: number, conservative: boolean) {
  const active = bets.filter((bet) => bet.status === 'active');
  const totals = new Map<PortfolioClass, { staked: number; ev: number }>();
  for (const bet of active) {
    const category = assetClassFor(bet.category);
    const row = totals.get(category) ?? { staked: 0, ev: 0 };
    row.staked += bet.amountWagered;
    row.ev += betEv(bet, conservative);
    totals.set(category, row);
  }
  if (active.length === 0 && fallbackCash > 0) totals.set('Cash', { staked: fallbackCash, ev: 0 });
  const total = [...totals.values()].reduce((sum, row) => sum + row.staked, 0);
  return [...totals.entries()].map(([category, row]) => ({
    category,
    color: CLASS_COLORS[category],
    staked: row.staked,
    pct: total > 0 ? (row.staked / total) * 100 : 0,
    evPct: total > 0 ? (row.ev / total) * 100 : 0,
  })).sort((a, b) => b.staked - a.staked);
}

export function buildEquitySeries(bets: TrackedBet[], fallbackCash: number, conservative: boolean) {
  const sorted = [...bets].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const activeStake = bets.filter((bet) => bet.status === 'active').reduce((sum, bet) => sum + bet.amountWagered, 0);
  const startingValue = fallbackCash || activeStake || 0;
  const firstTime = sorted[0] ? new Date(sorted[0].createdAt).getTime() : Date.now();
  const points = [{ time: firstTime - 3_600_000, value: startingValue }];
  let value = startingValue;
  for (const bet of sorted) {
    value += bet.status === 'won' ? bet.expectedReturn : bet.status === 'lost' ? -bet.amountWagered : betEv(bet, conservative);
    points.push({ time: new Date(bet.createdAt).getTime(), value });
  }
  points.push({ time: Date.now(), value });
  return points;
}

/**
 * Allocation ring. Real SVG arcs (stroke dash offsets around one circle) rather
 * than rotated rectangles, so segments meet cleanly and the hole picks up the
 * card colour in both themes.
 */
export function AllocationDonut({
  rows,
  size = 128,
  thickness = 18,
  caption,
  value,
}: {
  rows: AllocationRow[];
  size?: number;
  thickness?: number;
  /** Small label under the centred value, e.g. "staked". */
  caption?: string;
  value?: string;
}): React.ReactElement {
  const theme = useTheme();
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const segments = rows.filter((row) => row.pct > 0.05);

  const arcs = segments.map((row, index) => {
    const precedingPct = segments.slice(0, index).reduce((sum, earlier) => sum + earlier.pct, 0);
    return {
      key: row.category,
      color: row.color,
      length: (row.pct / 100) * circumference,
      offset: (precedingPct / 100) * circumference,
    };
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.backgroundSelected}
          strokeWidth={thickness}
          fill="none"
        />
        {arcs.map((arc) => (
          <Circle
            key={arc.key}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={arc.color}
            strokeWidth={thickness}
            strokeLinecap="butt"
            fill="none"
            strokeDasharray={`${Math.max(arc.length - 1.5, 0.5)} ${circumference}`}
            strokeDashoffset={-arc.offset}
            // Start at 12 o'clock and run clockwise.
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ))}
      </Svg>
      {value ? (
        <View style={{ alignItems: 'center' }}>
          <ThemedText
            style={{ fontSize: 17, fontWeight: '800', color: theme.text, fontVariant: ['tabular-nums'] }}>
            {value}
          </ThemedText>
          {caption ? (
            <ThemedText style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: theme.textTertiary }}>
              {caption.toUpperCase()}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Equity curve. Measures its own width so the line fills the card instead of
 * sitting in a fixed 280px box, and fades an area fill under it.
 */
export function PerformanceChart({
  points,
  height = 132,
}: {
  points: EquityPoint[];
  height?: number;
}): React.ReactElement {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const padY = 12;
  // Keep the end-of-series dot fully inside the box instead of half-clipped.
  const padX = 5;
  const plotWidth = Math.max(width - padX * 2, 1);
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, Math.max(1, max * 0.01));
  const rising = points.length > 1 && values[values.length - 1] >= values[0];
  const color = rising ? Brand[500] : Accent.red;

  const coords = points.map((point, index) => ({
    x: padX + (index / Math.max(1, points.length - 1)) * plotWidth,
    y: height - padY - ((point.value - min) / span) * (height - padY * 2),
  }));

  const line = coords.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
  const last = coords[coords.length - 1];
  const area = `${line} L${last.x.toFixed(2)} ${height} L${padX} ${height} Z`;

  return (
    <View onLayout={onLayout} style={{ width: '100%', height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.28} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {[0, 0.5, 1].map((position) => (
            <Path
              key={position}
              d={`M0 ${(height - 1) * position + 0.5} H${width}`}
              stroke={theme.border}
              strokeWidth={1}
            />
          ))}
          {points.length > 1 ? (
            <>
              <Path d={area} fill="url(#equityFill)" />
              <Path d={line} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
              <Circle cx={last.x} cy={last.y} r={7} fill={color} fillOpacity={0.18} />
              <Circle cx={last.x} cy={last.y} r={3.5} fill={color} />
            </>
          ) : (
            <Path
              d={`M0 ${height / 2} H${width}`}
              stroke={theme.borderStrong}
              strokeWidth={2}
              strokeDasharray="5 6"
            />
          )}
        </Svg>
      ) : null}
      {points.length <= 1 ? (
        <ThemedText
          style={{
            position: 'absolute',
            alignSelf: 'center',
            top: height / 2 + 10,
            fontSize: 11,
            color: theme.textTertiary,
          }}>
          Acquire a position to start the curve
        </ThemedText>
      ) : null}
    </View>
  );
}

/** Thin proportion bar used by the allocation legend. */
export function AllocationBar({ pct, color }: { pct: number; color: string }): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      style={{
        height: 5,
        borderRadius: Radius.pill,
        backgroundColor: theme.backgroundSelected,
        overflow: 'hidden',
      }}>
      <View
        style={{
          width: `${Math.max(Math.min(pct, 100), 1.5)}%`,
          height: '100%',
          borderRadius: Radius.pill,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

function assetClassFor(category: string): PortfolioClass {
  if (/polymarket|sports|prediction/i.test(category)) return 'Polymarket';
  if (/treasur|savings|hysa|cash/i.test(category)) return 'Treasuries';
  if (/option|call|put|spread/i.test(category)) return 'Options';
  if (/stock|etf|equity|s&p|nvda|voo/i.test(category)) return 'Stocks';
  if (/crypto|bitcoin|btc|eth/i.test(category)) return 'Crypto';
  return 'Other';
}
