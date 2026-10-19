import React, { useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { usePortfolioProgress } from '@/api/hooks/usePortfolioProgress';
import { useMoney } from '@/api/hooks/usePreferences';
import { useSavedRoutes } from '@/api/hooks/useSavedRoutes';
import { useTrackedBets } from '@/api/hooks/useTrackedBets';
import { BetCard } from '@/components/portfolio/PositionBetCard';
import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { MetricInfo } from '@/components/ui/MetricInfo';
import { notifySellRecommendation } from '@/lib/notifications';
import { useCelebrationArrival } from '@/hooks/use-celebration-arrival';
import { Brand, Radius, Semantic, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MONO } from '@/lib/portfolio-format';
import type { TrackedBet } from '@/types/bets';

export default function PositionsScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  // Set when a good-news notification brought them here: which position moved,
  // and whether the arrival is worth asking for a rating on the back of.
  const { betId: highlightId, celebrate } = useLocalSearchParams<{ betId?: string; celebrate?: string }>();
  const money = useMoney();
  const { bets, resolveBet, dismissSellAlert } = useTrackedBets();
  const { history } = useSavedRoutes();
  const fallbackBalance = history[0]?.quizSnapshot.balance ?? 0;
  const progress = usePortfolioProgress(fallbackBalance);
  const [refreshing, setRefreshing] = useState(false);
  const notifiedRef = useRef<Set<string>>(new Set());
  const scrollRef = useRef<ScrollView>(null);
  const highlightY = useRef<number | null>(null);

  useCelebrationArrival(celebrate === '1');

  // Scroll the named position into view once it has been laid out. Measured
  // rather than computed: the cards are different heights and the P&L hero above
  // them changes size with the number of digits in it.
  useEffect(() => {
    if (!highlightId) return;
    const timer = setTimeout(() => {
      if (highlightY.current == null) return;
      scrollRef.current?.scrollTo({ y: Math.max(0, highlightY.current - 12), animated: true });
    }, 350);
    return () => clearTimeout(timer);
  }, [highlightId, bets.length]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await progress.refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const sellAlerts = progress.sellAlerts;

  useEffect(() => {
    for (const alert of sellAlerts) {
      if (notifiedRef.current.has(alert.betId)) continue;
      notifiedRef.current.add(alert.betId);
      const bet = bets.find((b) => b.id === alert.betId);
      notifySellRecommendation(
        'Goal hit — sell now',
        bet
          ? `Your ${bet.category} position is up $${alert.unrealizedPnl.toFixed(0)}. Lock in your $${alert.profitGoal} target on ${bet.platform}.`
          : `You're up $${alert.unrealizedPnl.toFixed(0)} — sell to lock in your profit.`
      );
    }
  }, [sellAlerts, bets]);

  const stats = positionStats(bets, progress.livePnl + progress.projectedPnl);

  const pnlPositive = stats.pnl >= 0;
  const showSpinner = refreshing || progress.isRefreshing;
  // Foreground-only polling (useBetMonitoring) means prices simply stop moving
  // while the app is closed — reopening after a day away can otherwise show a
  // stale "Live data · 9:41 AM" with no hint that it's yesterday's 9:41 AM.
  const dataAgeMs = progress.updatedAt ? msSince(progress.updatedAt) : null;
  const isStale = dataAgeMs != null && dataAgeMs > 24 * 60 * 60 * 1000;

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <SafeAreaView className="flex-1">
        <ScrollView
          ref={scrollRef}
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
              {isStale && stats.active > 0 && (
                <Pressable
                  onPress={onRefresh}
                  accessibilityRole="button"
                  accessibilityLabel="Refresh live prices"
                  className="flex-row items-center active:opacity-75"
                  style={{
                    borderRadius: Radius.lg,
                    borderWidth: 1.5,
                    borderColor: Semantic.caution + '66',
                    backgroundColor: Semantic.caution + '18',
                    padding: 12,
                    gap: 10,
                  }}>
                  <Icon glyph="⏳" size={18} color={Semantic.caution} />
                  <View className="flex-1">
                    <ThemedText style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>
                      Prices haven&apos;t updated in over a day
                    </ThemedText>
                    <ThemedText style={{ fontSize: 11, color: theme.textSecondary, marginTop: 1 }}>
                      Tap to refresh and check for anything that resolved while you were away
                    </ThemedText>
                  </View>
                  <ThemedText style={{ fontSize: 13, fontWeight: '800', color: Semantic.caution }}>Refresh</ThemedText>
                </Pressable>
              )}

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
                <View className="flex-row items-center" style={{ gap: 6 }}>
                  <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.textTertiary, letterSpacing: 0.8 }}>
                    TOTAL P&L
                  </ThemedText>
                  <MetricInfo metric="totalPnl" />
                </View>
                <ThemedText style={{ fontSize: 40, fontWeight: '800', letterSpacing: -1, color: pnlPositive ? Semantic.positive : Semantic.negative, ...MONO }}>
                  {money(stats.pnl, { decimals: 0, signed: true })}
                </ThemedText>
                <View className="flex-row gap-4 mt-2">
                  <View className="flex-row items-center gap-1.5">
                    <ThemedText style={{ fontSize: 13, color: theme.textSecondary, ...MONO }}>{money(stats.wagered, { decimals: 0 })}</ThemedText>
                    <ThemedText style={{ fontSize: 12, color: theme.textTertiary }}>staked</ThemedText>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <ThemedText style={{ fontSize: 13, color: theme.textSecondary, ...MONO }}>{stats.active}</ThemedText>
                    <ThemedText style={{ fontSize: 12, color: theme.textTertiary }}>active</ThemedText>
                  </View>
                </View>
                {progress.updatedAt && stats.active > 0 && (
                  <ThemedText style={{ fontSize: 11, color: theme.textTertiary, marginTop: 4 }}>
                    Live data · {progress.updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </ThemedText>
                )}
              </View>

              {bets.map((bet) => (
                <View
                  key={bet.id}
                  onLayout={bet.id === highlightId
                    ? (event) => { highlightY.current = event.nativeEvent.layout.y; }
                    : undefined}>
                  <BetCard
                    bet={bet}
                    liveStatus={progress.statusById[bet.id]}
                    valuation={progress.positionById[bet.id]}
                    highlighted={bet.id === highlightId}
                    onResolve={resolveBet}
                    onDismissSell={() => dismissSellAlert(bet.id)}
                  />
                </View>
              ))}

              <ThemedText type="small" themeColor="textSecondary" className="text-center" style={{ opacity: 0.4 }}>
                Pull down for live prices · Sell when your goal hits
              </ThemedText>
            </>
          ) : (
            <View className="items-center gap-3 py-24">
              <View style={{ width: 64, height: 64, borderRadius: Radius.xl, backgroundColor: theme.backgroundElement, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border }}>
                <Icon glyph="📋" size={28} color={theme.textSecondary} strokeWidth={1.6} />
              </View>
              <ThemedText style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>No acquired positions yet</ThemedText>
              <ThemedText className="text-center" style={{ fontSize: 13, color: theme.textSecondary, maxWidth: 240 }}>
                Tap “Acquire” on any route to choose an amount and open your preferred marketplace
              </ThemedText>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** How long ago `date` was, read at render time. */
function msSince(date: Date): number {
  return Date.now() - date.getTime();
}

/** Money in, profit so far (settled plus open) and open count. */
function positionStats(bets: TrackedBet[], openPnl: number) {
  // Watched positions never had money in them, so they cannot count as wagered.
  const wagered = bets
    .filter((b) => b.status !== 'watching')
    .reduce((s, b) => s + b.amountWagered, 0);
  const won = bets.filter((b) => b.status === 'won').reduce((s, b) => s + b.expectedReturn, 0);
  const lost = bets.filter((b) => b.status === 'lost').reduce((s, b) => s + b.amountWagered, 0);
  return {
    wagered,
    pnl: won - lost + openPnl,
    active: bets.filter((b) => b.status === 'active').length,
  };
}
