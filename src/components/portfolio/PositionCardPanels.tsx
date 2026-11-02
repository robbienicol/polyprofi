import React from 'react';
import { Pressable, View } from 'react-native';

import { useMoney } from '@/api/hooks/usePreferences';
import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { Brand, OnBrand, Radius, Semantic, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MONO, signedPct } from '@/lib/portfolio-format';
import type { PositionValuation } from '@/lib/portfolio-progress';
import type { BetLiveStatus, TrackedBet } from '@/types/bets';

type ResolveHandler = (args: { id: string; status: TrackedBet['status'] }) => void;

/** The loud "goal hit, sell now" banner above a position's card. */
export function SellAlertBanner({
  bet,
  liveStatus,
  goal,
  isPoly,
  onResolve,
  onDismissSell,
}: {
  bet: TrackedBet;
  liveStatus: BetLiveStatus;
  goal: number;
  isPoly: boolean;
  onResolve: ResolveHandler;
  onDismissSell: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const money = useMoney();
  return (
    <View
      style={{
        borderRadius: Radius.lg,
        backgroundColor: Semantic.caution + '18',
        borderWidth: 1.5,
        borderColor: Semantic.caution + '66',
        padding: 14,
        gap: 10,
        ...Shadow.float,
      }}>
      <View className="flex-row items-center gap-2">
        <Icon glyph="💰" size={19} color={Semantic.caution} />
        <View className="flex-1">
          <ThemedText style={{ fontSize: 11, fontWeight: '800', color: Semantic.caution, letterSpacing: 0.6 }}>
            SELL NOW — GOAL HIT
          </ThemedText>
          <ThemedText style={{ fontSize: 14, fontWeight: '700', color: theme.text, marginTop: 2 }}>
            Up {money(liveStatus.unrealizedPnl, { decimals: 0 })} · your {money(goal, { decimals: 0 })} target is reached
          </ThemedText>
        </View>
      </View>
      <ThemedText style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 19 }}>
        {liveStatus.reason}
        {isPoly ? ' Head to Polymarket and sell your shares before the game turns.' : ''}
      </ThemedText>
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => onResolve({ id: bet.id, status: 'won' })}
          className="flex-1 py-3 items-center active:opacity-85"
          style={{ borderRadius: Radius.md, backgroundColor: Brand[500], ...Shadow.card }}>
          <View className="flex-row items-center" style={{ gap: 5 }}>
            <ThemedText style={{ fontSize: 14, fontWeight: '800', color: OnBrand }}>Sold</ThemedText>
            <Icon glyph="✓" size={14} color={OnBrand} strokeWidth={3} />
          </View>
        </Pressable>
        <Pressable
          onPress={onDismissSell}
          className="px-4 py-3 items-center active:opacity-70 border"
          style={{ borderRadius: Radius.md, borderColor: theme.border }}>
          <ThemedText style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary }}>Dismiss</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

/** A stock position's live quote: price, unrealised P&L and today's move. */
export function StockQuotePanel({ valuation }: { valuation: PositionValuation }): React.ReactElement {
  const theme = useTheme();
  const money = useMoney();
  return (
    <View
      className="gap-2"
      style={{
        borderRadius: Radius.md,
        padding: 12,
        backgroundColor: theme.backgroundSelected,
        borderWidth: 1,
        borderColor: theme.border,
      }}>
      <View className="flex-row justify-between items-center">
        <ThemedText style={{ fontSize: 11, fontWeight: '700', color: Brand[500], letterSpacing: 0.4 }}>
          ● LIVE QUOTE
        </ThemedText>
        <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.text, ...MONO }}>
          {valuation.symbol} {money(valuation.currentPrice ?? 0)}
        </ThemedText>
      </View>
      <View className="flex-row items-baseline gap-1.5">
        <ThemedText style={{ fontSize: 11, color: theme.textSecondary }}>Unrealized</ThemedText>
        <ThemedText style={{ fontSize: 20, fontWeight: '800', color: valuation.unrealizedPnl >= 0 ? Semantic.positive : Semantic.negative, ...MONO }}>
          {money(valuation.unrealizedPnl, { signed: true })}
        </ThemedText>
        <ThemedText style={{ fontSize: 11, color: theme.textTertiary, ...MONO }}>
          ({signedPct(valuation.returnPct, 2)}%)
        </ThemedText>
      </View>
      <ThemedText style={{ fontSize: 12, color: theme.textSecondary }}>
        {valuation.quantity?.toFixed(3)} shares · entry {money(valuation.entryPrice ?? 0)}
        {valuation.dayChangePct != null
          ? ` · today ${signedPct(valuation.dayChangePct, 2)}%`
          : ''}
      </ThemedText>
    </View>
  );
}

/** A monitored (non-stock) position: live price, P&L against its goal, and why. */
export function MonitorPanel({ liveStatus, goal }: { liveStatus: BetLiveStatus; goal: number }): React.ReactElement {
  const theme = useTheme();
  const money = useMoney();
  return (
    <View
      className="gap-2"
      style={{
        borderRadius: Radius.md,
        padding: 12,
        backgroundColor: theme.backgroundSelected,
        borderWidth: 1,
        borderColor: liveStatus.profitGoalHit ? Semantic.positive + '33' : theme.border,
      }}>
      <View className="flex-row justify-between items-center">
        <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.textTertiary, letterSpacing: 0.4 }}>
          {liveStatus.isLive ? '● LIVE' : 'MONITORING'}
        </ThemedText>
        {liveStatus.currentPrice != null && (
          <ThemedText style={{ fontSize: 11, fontWeight: '700', color: Semantic.positive, ...MONO }}>
            {(liveStatus.currentPrice * 100).toFixed(0)}¢
            {liveStatus.entryPrice != null ? ` · entry ${(liveStatus.entryPrice * 100).toFixed(0)}¢` : ''}
          </ThemedText>
        )}
      </View>

      {liveStatus.unrealizedPnl !== 0 || liveStatus.currentPrice != null ? (
        <View className="flex-row items-baseline gap-1.5">
          <ThemedText style={{ fontSize: 11, color: theme.textSecondary }}>Unrealized</ThemedText>
          <ThemedText
            style={{
              fontSize: 20,
              fontWeight: '800',
              color: liveStatus.unrealizedPnl >= goal ? Semantic.positive : liveStatus.unrealizedPnl >= 0 ? theme.text : Semantic.negative,
              ...MONO,
            }}>
            {money(liveStatus.unrealizedPnl, { decimals: 0, signed: true })}
          </ThemedText>
          <ThemedText style={{ fontSize: 11, color: theme.textTertiary }}>/ {money(goal, { decimals: 0 })} goal</ThemedText>
        </View>
      ) : null}

      <ThemedText style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 17 }} numberOfLines={3}>
        {liveStatus.reason}
      </ThemedText>
    </View>
  );
}

/** Won, lost, or never invested: the three ways an active position can end. */
export function ResolveButtons({ bet, onResolve }: { bet: TrackedBet; onResolve: ResolveHandler }): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => onResolve({ id: bet.id, status: 'won' })}
          className="flex-1 items-center active:opacity-75"
          style={{ borderRadius: Radius.md, paddingVertical: 10, backgroundColor: Semantic.positive + '20' }}>
          <View className="flex-row items-center" style={{ gap: 4 }}>
            <ThemedText style={{ fontSize: 13, fontWeight: '700', color: Semantic.positive }}>Won</ThemedText>
            <Icon glyph="✓" size={13} color={Semantic.positive} strokeWidth={3} />
          </View>
        </Pressable>
        <Pressable
          onPress={() => onResolve({ id: bet.id, status: 'lost' })}
          className="flex-1 items-center active:opacity-70 border"
          style={{ borderRadius: Radius.md, paddingVertical: 10, borderColor: theme.border }}>
          <View className="flex-row items-center" style={{ gap: 4 }}>
            <ThemedText style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary }}>Lost</ThemedText>
            <Icon glyph="✗" size={13} color={theme.textSecondary} strokeWidth={3} />
          </View>
        </Pressable>
      </View>
      {/* Won/Lost both assume money went in. Tracking a route you decided
          against needs its own answer, or the only way out is a false one —
          and as bare tertiary text under two buttons it read as a footnote
          rather than as the third option it is. */}
      <Pressable
        onPress={() => onResolve({ id: bet.id, status: 'watching' })}
        className="items-center active:opacity-70 border"
        style={{ borderRadius: Radius.md, paddingVertical: 10, borderColor: theme.border }}>
        <ThemedText style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary }}>
          I didn&apos;t invest — just watching
        </ThemedText>
      </Pressable>
    </View>
  );
}
