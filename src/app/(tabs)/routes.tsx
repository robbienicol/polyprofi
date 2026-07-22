import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useQuizAnswers } from '@/api/hooks/useQuizAnswers';
import { useRoutes } from '@/api/hooks/useRoutes';
import { useSavedRoutes } from '@/api/hooks/useSavedRoutes';
import { useTrackedBets } from '@/api/hooks/useTrackedBets';
import { NearMissToast } from '@/components/routes/NearMissToast';
import { RouteFilters } from '@/components/routes/RouteFilters';
import { RoutesHeader } from '@/components/routes/RoutesHeader';
import { TrackRouteForm } from '@/components/routes/TrackRouteForm';
import { RouteCard } from '@/components/molecules/RouteCard';
import { ThemedText } from '@/components/themed-text';
import { AnalyzingLoader } from '@/components/ui/loaders';
import { Accent, Brand, Radius, Shadow } from '@/constants/theme';
import { useNearMissToast } from '@/hooks/use-near-miss-toast';
import { useTheme } from '@/hooks/use-theme';
import { scheduleWeeklyReminder } from '@/lib/notifications';
import { parseEntryPrice } from '@/lib/parse-bet-line';
import { buildRouteResults } from '@/lib/route-results';
import type { RouteFilters as Filters } from '@/lib/route-results';
import { trackedAssetFields } from '@/lib/tracked-assets';
import type { Route, RouteParams, SavedRoutesBatch } from '@/types/routes';

const DEFAULT_FILTERS: Filters = {
  category: null,
  lossProfile: null,
  minimumProbability: 0,
  sort: 'score',
};

export default function RoutesScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { batchId, generate } = useLocalSearchParams<{ batchId?: string; generate?: string }>();
  const { quizAnswers } = useQuizAnswers();
  const { history, saveGeneratedRoutes } = useSavedRoutes();
  const { trackBet } = useTrackedBets();

  const viewedBatch = batchId ? history.find((batch) => batch.id === batchId) ?? null : null;
  const latestBatch = history[0] ?? null;
  const isGenerating = generate === '1';
  const isHistorical = viewedBatch !== null;
  const sessionParams: RouteParams | null = isGenerating && quizAnswers
    ? quizAnswers
    : viewedBatch?.quizSnapshot ?? latestBatch?.quizSnapshot ?? null;

  const [manualRefresh, setManualRefresh] = useState(false);
  const [recentRoutes, setRecentRoutes] = useState<Route[] | null>(null);
  const shouldFetch = sessionParams !== null && (isGenerating || manualRefresh);
  const { routes: fetchedRoutes, isLoading, isFetching, error, refresh } = useRoutes(sessionParams, { enabled: shouldFetch });
  const routes = shouldFetch ? fetchedRoutes : viewedBatch?.routes ?? recentRoutes ?? latestBatch?.routes ?? [];

  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [trackingAmount, setTrackingAmount] = useState('');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [investment, setInvestment] = useState(0);
  const [autoSize, setAutoSize] = useState(false);
  const [visibleCount, setVisibleCount] = useState(30);
  const savedGeneration = useRef<string | null>(null);

  useEffect(() => {
    scheduleWeeklyReminder();
  }, []);

  useEffect(() => {
    if (!isGenerating || isLoading || isFetching || !quizAnswers || fetchedRoutes.length === 0) return;
    const generationKey = `${fetchedRoutes.length}-${fetchedRoutes[0].id}-${quizAnswers.target}-${quizAnswers.timeframe}`;
    if (savedGeneration.current === generationKey) return;
    savedGeneration.current = generationKey;
    setRecentRoutes(fetchedRoutes);
    saveGeneratedRoutes(quizAnswers, fetchedRoutes);
    router.replace('/(tabs)/routes');
  }, [fetchedRoutes, isFetching, isGenerating, isLoading, quizAnswers, router, saveGeneratedRoutes]);

  const referenceStake = sessionParams?.balance ?? 1_000;
  const displayedInvestment = investment || referenceStake;

  function setInvestmentAndReset(amount: number): void {
    setAutoSize(false);
    setInvestment(Math.max(0, Math.round(amount)));
    setVisibleCount(30);
  }
  function setAutoSizeAndReset(enabled: boolean): void {
    setAutoSize(enabled);
    setVisibleCount(30);
  }
  function setFiltersAndReset(next: Filters): void {
    setFilters(next);
    setVisibleCount(30);
  }

  const results = sessionParams
    ? buildRouteResults(routes, sessionParams, displayedInvestment, autoSize, filters)
    : null;
  const ranked = results?.ranked ?? [];
  const filtered = results?.filtered ?? [];
  const categories = [...new Set(routes.map((route) => route.category))];
  const nearMiss = useNearMissToast(ranked);

  async function handleRefresh(): Promise<void> {
    if (isHistorical || !sessionParams) return;
    setManualRefresh(true);
    try {
      const refreshed = await refresh();
      if (refreshed.length > 0) {
        setRecentRoutes(refreshed);
        saveGeneratedRoutes(sessionParams, refreshed);
      }
    } finally {
      setManualRefresh(false);
    }
  }

  function confirmTrack(route: Route): void {
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
      amountWagered: Number(trackingAmount) || 0,
      status: 'active',
      createdAt: new Date().toISOString(),
      profitGoal: sessionParams?.target || route.expectedReturn,
      line: route.line,
      entryPrice,
      monitorQuery: `${route.description} ${route.line ?? ''}`,
      ...trackedAssetFields(route),
    });
    setTrackingId(null);
  }

  if (shouldFetch && isLoading && !error) {
    return <Screen><AnalyzingLoader /></Screen>;
  }
  if (history.length === 0 && !isGenerating && routes.length === 0 && !error) {
    return <EmptyRoutes onStart={() => router.push('/quiz')} />;
  }

  const goal = sessionParams ? {
    target: sessionParams.target,
    when: timeframeLabel(sessionParams.timeframe),
  } : null;
  const visibleRoutes = filtered.slice(0, visibleCount);

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-4 pt-6 pb-16 gap-3"
        refreshControl={<RefreshControl refreshing={(isFetching && !isLoading) || manualRefresh} onRefresh={handleRefresh} tintColor={Brand[500]} />}>
        {goal && (
          <RoutesHeader
            goal={goal}
            historical={isHistorical}
            batchLabel={isHistorical && viewedBatch ? formatBatchLabel(viewedBatch) : null}
            amount={displayedInvestment}
            autoSize={autoSize}
            referenceStake={referenceStake}
            routeCount={ranked.length}
            onAmountChange={setInvestmentAndReset}
            onAutoSizeChange={setAutoSizeAndReset}
            onNewSearch={() => router.push('/quiz')}
            onBackToLatest={() => router.replace('/(tabs)/routes')}
          />
        )}
        {ranked.length > 0 && <RouteFilters categories={categories} filters={filters} onChange={setFiltersAndReset} />}
        {error && <RoutesError message={error} onRetry={refresh} />}
        {visibleRoutes.map((route) => {
          const scoreBreakdown = results?.scoreById.get(route.id);
          if (!scoreBreakdown) return null;
          return (
            <View key={route.id} className="gap-0.5">
              <RouteCard
                route={route}
                requiredInvestment={results?.requiredInvestmentById.get(route.id)}
                currentInvestment={results?.selectedStake(route)}
                scoreBreakdown={scoreBreakdown}
                onTrack={trackingId === null ? () => { setTrackingId(route.id); setTrackingAmount(''); } : undefined}
                onPress={() => router.push(`/route/${route.id}?stake=${results?.selectedStake(route) ?? referenceStake}&available=${autoSize ? referenceStake : displayedInvestment}`)}
              />
              {trackingId === route.id && <TrackRouteForm amount={trackingAmount} onAmountChange={setTrackingAmount} onConfirm={() => confirmTrack(route)} onCancel={() => setTrackingId(null)} />}
            </View>
          );
        })}
        {visibleCount < filtered.length && (
          <Pressable onPress={() => setVisibleCount((count) => count + 30)} className="items-center active:opacity-70" style={{ borderRadius: Radius.md, paddingVertical: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.backgroundElement }}>
            <ThemedText style={{ fontSize: 13, fontWeight: '800', color: Brand[500] }}>Show 30 more · {filtered.length - visibleCount} remaining</ThemedText>
          </Pressable>
        )}
        {filtered.length === 0 && !isLoading && routes.length > 0 && <EmptyFiltered filters={filters} onClear={() => setFiltersAndReset(DEFAULT_FILTERS)} />}
        {routes.length > 0 && <ThemedText type="small" themeColor="textSecondary" className="text-center" style={{ opacity: 0.4 }}>{isHistorical ? 'Saved search · ' : ''}Pull down to refresh · For entertainment only</ThemedText>}
      </ScrollView>
      {nearMiss.visible && nearMiss.route && <NearMissToast route={nearMiss.route} opacity={nearMiss.opacity} onDismiss={nearMiss.dismiss} />}
    </Screen>
  );
}

function Screen({ children }: React.PropsWithChildren): React.ReactElement {
  const theme = useTheme();
  return <View className="flex-1" style={{ backgroundColor: theme.background }}><SafeAreaView className="flex-1">{children}</SafeAreaView></View>;
}

function EmptyRoutes({ onStart }: { onStart: () => void }): React.ReactElement {
  const theme = useTheme();
  return <Screen><View className="flex-1 justify-center px-6"><View className="items-center gap-4 py-10 px-6" style={{ borderRadius: Radius.xl, backgroundColor: theme.backgroundElevated, borderWidth: 1, borderColor: theme.border, ...Shadow.card }}><ThemedText style={{ fontSize: 40 }}>🎯</ThemedText><ThemedText style={{ fontSize: 22, fontWeight: '800', color: theme.text, textAlign: 'center' }}>Find prediction routes</ThemedText><ThemedText className="text-center" style={{ fontSize: 14, color: theme.textSecondary, lineHeight: 21, maxWidth: 300 }}>Set your goal and timeframe — we&apos;ll scan prediction markets and generate routes in one step.</ThemedText><Pressable onPress={onStart} className="self-stretch py-4 items-center active:opacity-85 mt-2" style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], ...Shadow.card }}><ThemedText style={{ fontSize: 16, fontWeight: '800', color: '#06140C' }}>Set goal & search →</ThemedText></Pressable></View></View></Screen>;
}

function RoutesError({ message, onRetry }: { message: string; onRetry: () => void }): React.ReactElement {
  const theme = useTheme();
  return <View className="items-center gap-2 py-10 px-6" style={{ borderRadius: Radius.lg, backgroundColor: Accent.red + '12', borderWidth: 1, borderColor: Accent.red + '30' }}><ThemedText style={{ fontSize: 24 }}>⚠️</ThemedText><ThemedText style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>Couldn&apos;t load routes</ThemedText><ThemedText className="text-center" style={{ fontSize: 13, color: theme.textSecondary }}>{message}</ThemedText><Pressable onPress={onRetry} className="active:opacity-70 mt-1" style={{ borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: Brand[500] }}><ThemedText style={{ fontSize: 13, fontWeight: '700', color: '#06140C' }}>Try again</ThemedText></Pressable></View>;
}

function EmptyFiltered({ filters, onClear }: { filters: Filters; onClear: () => void }): React.ReactElement {
  return <View className="items-center gap-2 py-8"><ThemedText type="smallBold">{filters.minimumProbability > 0 ? `No routes with ≥ ${filters.minimumProbability}% chance` : `No ${filters.category ?? ''} routes`}</ThemedText><Pressable onPress={onClear} className="active:opacity-60"><ThemedText type="small" style={{ color: Brand[500], fontWeight: '700' }}>Clear filters</ThemedText></Pressable></View>;
}

function timeframeLabel(timeframe: RouteParams['timeframe']): string {
  return ({ today: 'today', week: 'this week', month: 'this month', '3months': 'in 3 months', '1year': 'this year', '5years': 'in 5 years' })[timeframe];
}

function formatBatchLabel(batch: SavedRoutesBatch): string {
  const generated = new Date(batch.generatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const percent = batch.quizSnapshot.balance > 0 ? ((batch.quizSnapshot.target / batch.quizSnapshot.balance) * 100).toFixed(0) : '0';
  return `Saved ${generated} · +${percent}% · ${timeframeLabel(batch.quizSnapshot.timeframe)}`;
}
