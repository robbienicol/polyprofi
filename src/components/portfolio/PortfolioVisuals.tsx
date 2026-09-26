import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Brand, CategoryScale, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { betEv } from '@/lib/portfolio';
import type { TrackedBet } from '@/types/bets';

const CLASS_COLORS = {
  Polymarket: CategoryScale.clay,
  Treasuries: CategoryScale.slate,
  Options: CategoryScale.rust,
  Stocks: CategoryScale.haze,
  Crypto: CategoryScale.sand,
  Cash: CategoryScale.stone,
  Other: CategoryScale.ink,
} as const;

type PortfolioClass = keyof typeof CLASS_COLORS;
export type AllocationRow = ReturnType<typeof buildAllocationRows>[number];

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
  /** Small label under the centred value, e.g. "invested". */
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
 * The spread between the worst and best modelled outcomes, with the average
 * marked on it and break-even marked behind that.
 *
 * A single expected figure hides the thing people most need to see, which is how
 * far apart the good day and the bad day are. Break-even is drawn because it is
 * the only line on the bar that means something concrete — left of it is holding
 * less than you put in — and without it the marker is a dot on an unlabelled axis.
 */
export function OutcomeRangeBar({
  expectedPosition,
  breakEvenPosition,
}: {
  /** Where the average outcome sits between the two ends, 0–1. */
  expectedPosition: number;
  /** Where the money put in sits, 0–1, or null when it falls outside the range. */
  breakEvenPosition: number | null;
}): React.ReactElement {
  const theme = useTheme();
  const clamp = (value: number): number => Math.min(1, Math.max(0, value));
  return (
    <View style={{ height: 26, justifyContent: 'center' }}>
      <View style={{ height: 8, borderRadius: Radius.pill, backgroundColor: theme.backgroundSelected, overflow: 'hidden' }}>
        {/* Everything up to the average, so the bar reads as a fill rather than as a
            dot floating on an empty track. */}
        <View
          style={{
            width: `${clamp(expectedPosition) * 100}%`,
            height: '100%',
            borderRadius: Radius.pill,
            backgroundColor: Brand[500] + '55',
          }}
        />
      </View>

      {breakEvenPosition != null ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: `${clamp(breakEvenPosition) * 100}%`,
            width: 2,
            height: 18,
            marginLeft: -1,
            borderRadius: Radius.pill,
            backgroundColor: theme.textTertiary,
          }}
        />
      ) : null}

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: `${clamp(expectedPosition) * 100}%`,
          width: 14,
          height: 14,
          marginLeft: -7,
          borderRadius: Radius.pill,
          backgroundColor: Brand[500],
          borderWidth: 2.5,
          borderColor: theme.backgroundElevated,
        }}
      />
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
