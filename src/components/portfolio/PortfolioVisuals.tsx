import { View } from 'react-native';

import { Accent, Brand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { betEv } from '@/lib/portfolio';
import type { TrackedBet } from '@/types/bets';

const CHART_WIDTH = 280;
const CHART_HEIGHT = 150;
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

export function AllocationDonut({ rows }: { rows: AllocationRow[] }): React.ReactElement {
  const segments = 40;
  const activeRows = rows.filter((row) => row.pct > 0);
  const cumulative = activeRows.map((_, index) => activeRows.slice(0, index + 1).reduce((sum, row) => sum + row.pct, 0));
  const colors = Array.from({ length: segments }, (_, index) => {
    const midpoint = ((index + 0.5) / segments) * 100;
    const rowIndex = cumulative.findIndex((threshold) => midpoint <= threshold);
    return activeRows[rowIndex < 0 ? activeRows.length - 1 : rowIndex]?.color ?? '#1F2937';
  });
  return (
    <View style={{ width: 142, height: 142, alignItems: 'center', justifyContent: 'center' }}>
      {colors.map((color, index) => <View key={`${color}-${index}`} style={{ position: 'absolute', width: 10, height: 24, borderRadius: 6, backgroundColor: color, transform: [{ rotate: `${(index / segments) * 360}deg` }, { translateY: -58 }] }} />)}
      <View style={{ width: 82, height: 82, borderRadius: 999, backgroundColor: '#07120F', borderWidth: 1, borderColor: '#10251D' }} />
    </View>
  );
}

export function PerformanceChart({ points }: { points: EquityPoint[] }): React.ReactElement {
  const theme = useTheme();
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const range = Math.max(1, Math.max(...values) - min);
  const color = points[points.length - 1].value >= points[0].value ? Brand[500] : Accent.red;
  const normalized = points.map((point, index) => ({
    x: (index / Math.max(1, points.length - 1)) * CHART_WIDTH,
    y: CHART_HEIGHT - ((point.value - min) / range) * (CHART_HEIGHT - 18) - 9,
  }));
  const segments = normalized.slice(1).map((point, index) => {
    const previous = normalized[index];
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    return { key: `${index}-${point.x}`, left: previous.x, top: previous.y, width: Math.hypot(dx, dy), angle: Math.atan2(dy, dx) };
  });
  return (
    <View style={{ width: '100%', height: CHART_HEIGHT, overflow: 'hidden' }}>
      {[0.25, 0.5, 0.75].map((position) => <View key={position} style={{ position: 'absolute', left: 0, right: 0, top: CHART_HEIGHT * position, height: 1, backgroundColor: theme.border, opacity: 0.5 }} />)}
      <View style={{ width: CHART_WIDTH, height: CHART_HEIGHT, alignSelf: 'center' }}>
        {segments.map((segment) => <View key={segment.key} style={{ position: 'absolute', left: segment.left, top: segment.top, width: segment.width, height: 3, borderRadius: Radius.pill, backgroundColor: color, transform: [{ translateX: segment.width / 2 }, { rotateZ: `${segment.angle}rad` }, { translateX: -segment.width / 2 }] }} />)}
        {normalized.slice(-1).map((point) => <View key={`${point.x}-${point.y}`} style={{ position: 'absolute', left: point.x - 4, top: point.y - 4, width: 8, height: 8, borderRadius: Radius.pill, backgroundColor: color }} />)}
      </View>
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
