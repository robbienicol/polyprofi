import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSavedRoutes } from '@/api/hooks/useSavedRoutes';
import { useTrackedBets } from '@/api/hooks/useTrackedBets';
import { timeframeCalendarDays } from '@/api/client/playbook';
import { RelatedRoutes } from '@/components/routes/RelatedRoutes';
import { RouteCoach } from '@/components/routes/RouteCoach';
import { RouteOpportunityCard } from '@/components/routes/RouteOpportunityCard';
import { ScoreMathCard } from '@/components/routes/ScoreMathCard';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { parseEntryPrice } from '@/lib/parse-bet-line';
import { openTradeDestination } from '@/lib/route-actions';
import { goalEffectivenessScore } from '@/lib/score';
import { rescoreForStake, stakeNeededForReturn } from '@/lib/stake-rescore';
import { trackedAssetFields } from '@/lib/tracked-assets';

export default function RouteDetailScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { id, stake: stakeParam, available: availableParam } = useLocalSearchParams<{ id: string; stake?: string; available?: string }>();
  const { history } = useSavedRoutes();
  const { trackBet, isTracking } = useTrackedBets();
  const [added, setAdded] = useState(false);

  const batch = history.find((item) => item.routes.some((route) => route.id === id));
  const savedRoute = batch?.routes.find((route) => route.id === id);
  if (!savedRoute) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: theme.background }}>
        <ThemedText themeColor="textSecondary">This pick is no longer available.</ThemedText>
        <Pressable onPress={() => router.back()} className="mt-3 active:opacity-60"><ThemedText style={{ color: Brand[500], fontWeight: '700' }}>← Back</ThemedText></Pressable>
      </View>
    );
  }

  const baseStake = batch?.quizSnapshot.balance ?? 0;
  const requestedStake = Number(stakeParam);
  const stake = Number.isFinite(requestedStake) && requestedStake > 0 ? Math.round(requestedStake) : baseStake;
  const requestedAvailable = Number(availableParam);
  const availableInvestment = Number.isFinite(requestedAvailable) && requestedAvailable > 0
    ? Math.round(requestedAvailable)
    : stake || baseStake;
  const targetProfit = batch?.quizSnapshot.target ?? savedRoute.expectedReturn;
  const route = rescoreForStake([savedRoute], baseStake || stake || 1, stake || baseStake || 1, targetProfit)[0];
  const neededToHitGoal = stakeNeededForReturn(savedRoute, baseStake || stake || 1, targetProfit);
  const scoreBreakdown = goalEffectivenessScore(route, {
    target: targetProfit,
    requiredInvestment: neededToHitGoal,
    availableInvestment,
    deadlineDays: timeframeCalendarDays(batch?.quizSnapshot.timeframe ?? ''),
  });
  const relatedRoutes = (batch?.routes ?? [])
    .filter((candidate) => candidate.id !== route.id)
    .sort((a, b) => Number(b.category === route.category) - Number(a.category === route.category) || Math.abs(a.probability - route.probability) - Math.abs(b.probability - route.probability))
    .slice(0, 3);

  function addToPortfolio(): void {
    if (added || isTracking) return;
    const predictionMarket = /polymarket|prediction/i.test(`${route.category} ${route.platform}`);
    const entryPrice = parseEntryPrice(route.line) ?? (predictionMarket && route.probability > 0 ? route.probability / 100 : undefined);
    trackBet({
      id: `${route.id}-${Date.now()}`,
      category: route.category,
      emoji: route.emoji,
      description: route.description,
      platform: route.platform,
      strategy: route.strategy,
      riskLevel: route.riskLevel,
      probability: route.probability,
      expectedReturn: route.expectedReturn,
      amountWagered: stake || Math.max(1, Math.round(route.expectedReturn / 2)),
      status: 'active',
      createdAt: new Date().toISOString(),
      profitGoal: targetProfit,
      line: route.line,
      entryPrice,
      monitorQuery: `${route.description} ${route.line ?? ''}`,
      ...trackedAssetFields(route),
    }, { onSuccess: () => setAdded(true) });
  }

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <SafeAreaView className="flex-1">
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-4 pt-3 pb-16 gap-4">
          <View className="flex-row items-center justify-between" style={{ paddingVertical: 6 }}>
            <Pressable onPress={() => router.back()} className="active:opacity-60" hitSlop={12}><ThemedText style={{ fontSize: 28, color: theme.textSecondary, lineHeight: 30 }}>‹</ThemedText></Pressable>
            <ThemedText style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Opportunity</ThemedText>
            <Pressable onPress={() => openTradeDestination(route, route.platform.toLowerCase().includes('polymarket') ? 'polymarket' : 'robinhood')} className="active:opacity-60" hitSlop={12}><ThemedText style={{ fontSize: 20, color: theme.textSecondary }}>⇧</ThemedText></Pressable>
          </View>

          <RouteOpportunityCard route={route} stake={stake} neededToHitGoal={neededToHitGoal} added={added} adding={isTracking} onAdd={addToPortfolio} />

          <ScoreMathCard scoreBreakdown={scoreBreakdown} requiredInvestment={neededToHitGoal} availableInvestment={availableInvestment} />

          <View style={{ backgroundColor: theme.backgroundElement, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: theme.border }}>
            <ThemedText style={{ fontSize: 10, color: theme.textTertiary, fontWeight: '700', letterSpacing: 0.6, marginBottom: 4 }}>THE PLAY</ThemedText>
            <ThemedText style={{ fontSize: 13.5, color: theme.text, lineHeight: 20 }}>{route.strategy}</ThemedText>
          </View>

          <View className="flex-row gap-2">
            <TradeLink label="Open in Polymarket ↗" onPress={() => openTradeDestination(route, 'polymarket')} />
            <TradeLink label="Open in Robinhood ↗" onPress={() => openTradeDestination(route, 'robinhood')} />
          </View>

          <RouteCoach route={route} />
          <RelatedRoutes routes={relatedRoutes} onSelect={(selected) => router.push(`/route/${selected.id}`)} />
          <ThemedText className="text-center" style={{ fontSize: 11, color: theme.textTertiary, opacity: 0.6, marginTop: 4 }}>For entertainment only · Not financial advice</ThemedText>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function TradeLink({ label, onPress }: { label: string; onPress: () => void }): React.ReactElement {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} className="flex-1 active:opacity-75" style={{ borderRadius: Radius.md, paddingVertical: 11, alignItems: 'center', backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.border }}>
      <ThemedText style={{ fontSize: 13, fontWeight: '800', color: Brand[500] }}>{label}</ThemedText>
    </Pressable>
  );
}
