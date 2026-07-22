import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useBetMonitoring } from '@/api/hooks/useBetMonitoring';
import { useTrackedBets } from '@/api/hooks/useTrackedBets';
import { ThemedText } from '@/components/themed-text';
import { riskColor, riskLabel } from '@/components/molecules/RouteCard';
import { isPredictionMarketBet } from '@/lib/parse-bet-line';
import { notifySellRecommendation } from '@/lib/notifications';
import { Accent, Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { BetLiveStatus, TrackedBet } from '@/types/bets';

const MONO = { fontVariant: ['tabular-nums' as const] };

function profitGoalFor(bet: TrackedBet): number {
  return (bet.profitGoal ?? 0) > 0 ? bet.profitGoal! : bet.expectedReturn;
}

export default function PositionsScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { bets, resolveBet, dismissSellAlert } = useTrackedBets();
  const { statusById, isFetching, refetch, lastUpdated } = useBetMonitoring();
  const [refreshing, setRefreshing] = useState(false);
  const notifiedRef = useRef<Set<string>>(new Set());

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const sellAlerts = useMemo(
    () => Object.values(statusById).filter((s) => s.sellRecommended),
    [statusById]
  );

  useEffect(() => {
    for (const alert of sellAlerts) {
      if (notifiedRef.current.has(alert.betId)) continue;
      notifiedRef.current.add(alert.betId);
      const bet = bets.find((b) => b.id === alert.betId);
      notifySellRecommendation(
        'Goal hit — sell now 💰',
        bet
          ? `Your ${bet.category} position is up $${alert.unrealizedPnl.toFixed(0)}. Lock in your $${alert.profitGoal} target on ${bet.platform}.`
          : `You're up $${alert.unrealizedPnl.toFixed(0)} — sell to lock in your profit.`
      );
    }
  }, [sellAlerts, bets]);

  const stats = useMemo(() => {
    const wagered = bets.reduce((s, b) => s + b.amountWagered, 0);
    const won = bets.filter((b) => b.status === 'won').reduce((s, b) => s + b.expectedReturn, 0);
    const lost = bets.filter((b) => b.status === 'lost').reduce((s, b) => s + b.amountWagered, 0);
    return { wagered, pnl: won - lost, active: bets.filter((b) => b.status === 'active').length };
  }, [bets]);

  const pnlPositive = stats.pnl >= 0;
  const showSpinner = refreshing || isFetching;

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <SafeAreaView className="flex-1">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="px-4 pt-6 pb-16 gap-3"
          refreshControl={
            <RefreshControl refreshing={showSpinner} onRefresh={onRefresh} tintColor={Brand[500]} />
          }>

          <View className="flex-row items-center gap-3 pb-1">
            <Pressable onPress={() => router.back()} className="active:opacity-60" style={{ paddingVertical: 4, paddingRight: 8 }}>
              <ThemedText style={{ fontSize: 15, color: theme.textSecondary, fontWeight: '600' }}>← Back</ThemedText>
            </Pressable>
            <ThemedText style={{ fontSize: 20, fontWeight: '800', color: theme.text, letterSpacing: -0.3 }}>Positions</ThemedText>
          </View>

          {bets.length > 0 ? (
            <>
              {/* P&L hero */}
              <View
                style={{
                  borderRadius: Radius.xl,
                  backgroundColor: theme.backgroundElevated,
                  borderWidth: 1,
                  borderColor: theme.border,
                  padding: 20,
                  gap: 4,
                  ...Shadow.card,
                }}>
                <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.textTertiary, letterSpacing: 0.8 }}>
                  TOTAL P&L
                </ThemedText>
                <ThemedText style={{ fontSize: 40, fontWeight: '800', letterSpacing: -1, color: pnlPositive ? Brand[500] : Accent.red, ...MONO }}>
                  {pnlPositive ? '+' : '−'}${Math.abs(stats.pnl).toFixed(0)}
                </ThemedText>
                <View className="flex-row gap-4 mt-2">
                  <View className="flex-row items-center gap-1.5">
                    <ThemedText style={{ fontSize: 13, color: theme.textSecondary, ...MONO }}>${stats.wagered.toFixed(0)}</ThemedText>
                    <ThemedText style={{ fontSize: 12, color: theme.textTertiary }}>wagered</ThemedText>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <ThemedText style={{ fontSize: 13, color: theme.textSecondary, ...MONO }}>{stats.active}</ThemedText>
                    <ThemedText style={{ fontSize: 12, color: theme.textTertiary }}>active</ThemedText>
                  </View>
                </View>
                {lastUpdated && stats.active > 0 && (
                  <ThemedText style={{ fontSize: 11, color: theme.textTertiary, marginTop: 4 }}>
                    Live data · {lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </ThemedText>
                )}
              </View>

              {bets.map((bet) => (
                <BetCard
                  key={bet.id}
                  bet={bet}
                  liveStatus={statusById[bet.id]}
                  onResolve={resolveBet}
                  onDismissSell={() => dismissSellAlert(bet.id)}
                />
              ))}

              <ThemedText type="small" themeColor="textSecondary" className="text-center" style={{ opacity: 0.4 }}>
                Pull down for live prices & scores · Sell when your goal hits
              </ThemedText>
            </>
          ) : (
            <View className="items-center gap-3 py-24">
              <View style={{ width: 64, height: 64, borderRadius: Radius.xl, backgroundColor: theme.backgroundElement, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border }}>
                <ThemedText style={{ fontSize: 30 }}>📋</ThemedText>
              </View>
              <ThemedText style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>No tracked bets yet</ThemedText>
              <ThemedText className="text-center" style={{ fontSize: 13, color: theme.textSecondary, maxWidth: 240 }}>
                Tap “Track” on any route in your feed to start logging your P&L
              </ThemedText>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

interface BetCardProps {
  bet: TrackedBet;
  liveStatus?: BetLiveStatus;
  onResolve: (args: { id: string; status: TrackedBet['status'] }) => void;
  onDismissSell: () => void;
}

function BetCardInner({ bet, liveStatus, onResolve, onDismissSell }: BetCardProps): React.ReactElement {
  const theme = useTheme();
  const rc = riskColor(bet.riskLevel);
  const goal = profitGoalFor(bet);
  const isActive = bet.status === 'active';
  const showSell = isActive && liveStatus?.sellRecommended;
  const isPoly = isPredictionMarketBet(bet);

  return (
    <View className="gap-2">
      {showSell && liveStatus && (
        <View
          style={{
            borderRadius: Radius.lg,
            backgroundColor: Accent.gold + '18',
            borderWidth: 1.5,
            borderColor: Accent.gold + '66',
            padding: 14,
            gap: 10,
            ...Shadow.float,
          }}>
          <View className="flex-row items-center gap-2">
            <ThemedText style={{ fontSize: 20 }}>💰</ThemedText>
            <View className="flex-1">
              <ThemedText style={{ fontSize: 11, fontWeight: '800', color: Accent.gold, letterSpacing: 0.6 }}>
                SELL NOW — GOAL HIT
              </ThemedText>
              <ThemedText style={{ fontSize: 14, fontWeight: '700', color: theme.text, marginTop: 2 }}>
                Up ${liveStatus.unrealizedPnl.toFixed(0)} · your ${goal} target is reached
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
              <ThemedText style={{ fontSize: 14, fontWeight: '800', color: '#06140C' }}>Sold ✓</ThemedText>
            </Pressable>
            <Pressable
              onPress={onDismissSell}
              className="px-4 py-3 items-center active:opacity-70 border"
              style={{ borderRadius: Radius.md, borderColor: theme.border }}>
              <ThemedText style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary }}>Dismiss</ThemedText>
            </Pressable>
          </View>
        </View>
      )}

      <View
        style={{
          borderRadius: Radius.lg,
          overflow: 'hidden',
          backgroundColor: theme.backgroundElement,
          borderWidth: 1,
          borderColor: showSell ? Accent.gold + '55' : theme.border,
          ...Shadow.card,
        }}>
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: rc }} />
        <View style={{ paddingLeft: 18, paddingRight: 14, paddingVertical: 14, gap: 12 }}>

          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center gap-2.5">
              <ThemedText style={{ fontSize: 20 }}>{bet.emoji}</ThemedText>
              <View>
                <ThemedText style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>{bet.category}</ThemedText>
                <ThemedText style={{ fontSize: 11, color: theme.textTertiary }}>{bet.platform} · {riskLabel(bet.riskLevel)}</ThemedText>
              </View>
            </View>
            <StatusBadge status={bet.status} isLive={liveStatus?.isLive} />
          </View>

          <ThemedText style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 19 }} numberOfLines={2}>{bet.description}</ThemedText>

          {bet.line ? (
            <View
              className="self-start px-2.5 py-1"
              style={{ borderRadius: Radius.sm, backgroundColor: theme.backgroundSelected }}>
              <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.text, ...MONO }}>{bet.line}</ThemedText>
            </View>
          ) : null}

          {isActive && liveStatus && (
            <View
              className="gap-2"
              style={{
                borderRadius: Radius.md,
                padding: 12,
                backgroundColor: theme.backgroundSelected,
                borderWidth: 1,
                borderColor: liveStatus.profitGoalHit ? Brand[500] + '33' : theme.border,
              }}>
              <View className="flex-row justify-between items-center">
                <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.textTertiary, letterSpacing: 0.4 }}>
                  {liveStatus.isLive ? '● LIVE' : 'MONITORING'}
                </ThemedText>
                {liveStatus.currentPrice != null && (
                  <ThemedText style={{ fontSize: 11, fontWeight: '700', color: Brand[500], ...MONO }}>
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
                      color: liveStatus.unrealizedPnl >= goal ? Brand[500] : liveStatus.unrealizedPnl >= 0 ? theme.text : Accent.red,
                      ...MONO,
                    }}>
                    {liveStatus.unrealizedPnl >= 0 ? '+' : '−'}${Math.abs(liveStatus.unrealizedPnl).toFixed(0)}
                  </ThemedText>
                  <ThemedText style={{ fontSize: 11, color: theme.textTertiary }}>/ ${goal} goal</ThemedText>
                </View>
              ) : null}

              <ThemedText style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 17 }} numberOfLines={3}>
                {liveStatus.reason}
              </ThemedText>
            </View>
          )}

          <View className="flex-row justify-between items-end">
            <View>
              <View className="flex-row items-baseline gap-1.5">
                <ThemedText style={{ fontSize: 18, fontWeight: '800', color: theme.text, ...MONO }}>${bet.amountWagered}</ThemedText>
                <ThemedText style={{ fontSize: 12, color: theme.textTertiary }}>staked → </ThemedText>
                <ThemedText style={{ fontSize: 13, fontWeight: '700', color: Brand[500], ...MONO }}>+${bet.expectedReturn}</ThemedText>
              </View>
            </View>

            {isActive && !showSell && (
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => onResolve({ id: bet.id, status: 'won' })}
                  className="active:opacity-75"
                  style={{ borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Brand[500] + '20' }}>
                  <ThemedText style={{ fontSize: 13, fontWeight: '700', color: Brand[500] }}>Won ✓</ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => onResolve({ id: bet.id, status: 'lost' })}
                  className="active:opacity-70 border"
                  style={{ borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 8, borderColor: theme.border }}>
                  <ThemedText style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary }}>Lost ✗</ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const BetCard = memo(BetCardInner);

function StatusBadge({
  status,
  isLive,
}: {
  status: TrackedBet['status'];
  isLive?: boolean;
}): React.ReactElement {
  const map = {
    active: { color: isLive ? Brand[500] : Accent.gold, label: isLive ? 'Live' : 'Active' },
    won: { color: Brand[500], label: 'Won ✓' },
    lost: { color: Accent.red, label: 'Lost ✗' },
  };
  const { color, label } = map[status];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.pill, backgroundColor: color + '1A' }}>
      <View style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: color }} />
      <ThemedText style={{ fontSize: 11, fontWeight: '700', color }}>{label}</ThemedText>
    </View>
  );
}
