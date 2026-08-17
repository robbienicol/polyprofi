import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useQuizAnswers } from '@/api/hooks/useQuizAnswers';
import { useRoutes } from '@/api/hooks/useRoutes';
import { usePredictionSearch } from '@/api/hooks/usePredictionSearch';
import { useSavedRoutes } from '@/api/hooks/useSavedRoutes';
import { useSavingsGoal } from '@/api/hooks/useSavingsGoal';
import { useTrackedBets } from '@/api/hooks/useTrackedBets';
import { RouteFilters } from '@/components/routes/RouteFilters';
import { RoutesHeader } from '@/components/routes/RoutesHeader';
import { TrackRouteForm } from '@/components/routes/TrackRouteForm';
import { RouteCard } from '@/components/molecules/RouteCard';
import { ThemedText } from '@/components/themed-text';
import { AnalyzingLoader, BrandLoader } from '@/components/ui/loaders';
import { Accent, Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { betOutcomeSide } from '@/lib/bet-monitor-match';
import { scheduleWeeklyReminder } from '@/lib/notifications';
import { parseEntryPrice } from '@/lib/parse-bet-line';
import { openTradeDestination, preferredTradeDestination, tradeDestinationLabel } from '@/lib/route-actions';
import { activeKeyword, buildRouteResults, groupRoutesByChance, predictionFacetsActive, resolveInvestmentAmount } from '@/lib/route-results';
import type { RouteFilters as Filters } from '@/lib/route-results';
import { trackedPositionFields } from '@/lib/tracked-assets';
import type { Route, RouteParams, SavedRoutesBatch } from '@/types/routes';

const DEFAULT_FILTERS: Filters = {
  category: null,
  lossProfile: null,
  minimumProbability: 0,
  sort: 'score',
  predictionTopic: null,
  maxDaysToResolve: null,
  groupByChance: false,
  keyword: '',
};

export default function RoutesScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  // The goal this search is for, handed over by the quiz. Historical batches carry
  // their own goalId instead.
  const { batchId, generate, goalId } = useLocalSearchParams<{ batchId?: string; generate?: string; goalId?: string }>();
  const { quizAnswers, isLoading: quizLoading } = useQuizAnswers();
  const { history, saveGeneratedRoutes } = useSavedRoutes();
  const { allGoals, confirmGoal } = useSavingsGoal();
  const { trackBet } = useTrackedBets();

  const viewedBatch = batchId ? history.find((batch) => batch.id === batchId) ?? null : null;
  const latestBatch = history[0] ?? null;
  const isGenerating = generate === '1';
  const isHistorical = viewedBatch !== null;
  const sessionParams: RouteParams | null = isGenerating && quizAnswers
    ? quizAnswers
    : viewedBatch?.quizSnapshot ?? latestBatch?.quizSnapshot ?? null;
  // The goal these routes belong to: the one the quiz handed over, else the one
  // the shown batch was saved for. Every position taken here inherits it. A goal
  // that has since been swept away is dropped rather than left dangling on a
  // position, so a stale batch can't attach money to something that isn't there.
  const batchGoalId = goalId ?? viewedBatch?.goalId ?? latestBatch?.goalId;
  const sessionGoalId = batchGoalId && allGoals.some((goal) => goal.id === batchGoalId)
    ? batchGoalId
    : undefined;

  const [manualRefresh, setManualRefresh] = useState(false);
  const [recentRoutes, setRecentRoutes] = useState<Route[] | null>(null);
  const shouldFetch = sessionParams !== null && (isGenerating || manualRefresh);
  const { routes: fetchedRoutes, isLoading, isFetching, error, refresh } = useRoutes(sessionParams, { enabled: shouldFetch });
  // Memoised because the keyword-search pool below derives from it: a fresh array
  // every render would rebuild that pool every render.
  const routes = useMemo(
    () => (shouldFetch ? fetchedRoutes : viewedBatch?.routes ?? recentRoutes ?? latestBatch?.routes ?? []),
    [shouldFetch, fetchedRoutes, viewedBatch?.routes, recentRoutes, latestBatch?.routes],
  );

  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [trackingAmount, setTrackingAmount] = useState('');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [investment, setInvestment] = useState<number | null>(null);
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
    saveGeneratedRoutes(quizAnswers, fetchedRoutes, goalId);
    // Drop generate=1 so a remount doesn't re-search, but keep the goal: the saved
    // batch that carries it may not have landed in the cache yet.
    router.replace((goalId ? `/(tabs)/routes?goalId=${goalId}` : '/(tabs)/routes') as Href);
  }, [goalId, fetchedRoutes, isFetching, isGenerating, isLoading, quizAnswers, router, saveGeneratedRoutes]);

  const referenceStake = sessionParams?.balance ?? 1_000;
  const displayedInvestment = resolveInvestmentAmount(investment, referenceStake);

  function setInvestmentAndReset(amount: number): void {
    setInvestment(Math.max(0, Math.round(amount)));
    setVisibleCount(30);
  }
  function setFiltersAndReset(next: Filters): void {
    setFilters(next);
    setVisibleCount(30);
  }

  // Keyword search reaches past this goal's pool into all of Polymarket, so its hits
  // are merged in before scoring. Ids already present win, so a market that is both
  // searched and already a route is not duplicated.
  const search = usePredictionSearch(activeKeyword(filters), sessionParams);
  const searchPool = useMemo(() => {
    if (search.routes.length === 0) return routes;
    const known = new Set(routes.map((route) => route.id));
    return [...routes, ...search.routes.filter((route) => !known.has(route.id))];
  }, [routes, search.routes]);

  const results = sessionParams
    ? buildRouteResults(searchPool, sessionParams, displayedInvestment, filters)
    : null;
  const ranked = results?.ranked ?? [];
  const filtered = results?.filtered ?? [];

  async function handleRefresh(): Promise<void> {
    if (isHistorical || !sessionParams) return;
    setManualRefresh(true);
    try {
      const refreshed = await refresh();
      if (refreshed.length > 0) {
        setRecentRoutes(refreshed);
        saveGeneratedRoutes(sessionParams, refreshed, sessionGoalId);
      }
    } finally {
      setManualRefresh(false);
    }
  }

  function confirmAcquire(route: Route): void {
    const amount = Number(trackingAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const predictionMarket = /polymarket|prediction/i.test(`${route.category} ${route.platform}`);
    const entryPrice = parseEntryPrice(route.line) ?? (predictionMarket && route.probability > 0 ? route.probability / 100 : undefined);
    const destination = preferredTradeDestination(route, sessionParams?.preferredPlatforms);
    const openedAt = new Date().toISOString();
    trackBet({
      id: `${route.id}-${Date.now()}`,
      // The position works toward the goal this search was run for.
      goalId: sessionGoalId,
      category: route.category,
      emoji: route.emoji,
      description: route.description,
      platform: route.platform,
      strategy: route.strategy,
      riskLevel: route.riskLevel,
      probability: route.probability,
      expectedReturn: route.expectedReturn,
      amountWagered: amount,
      status: 'active',
      createdAt: openedAt,
      profitGoal: sessionParams?.target || route.expectedReturn,
      line: route.line,
      entryPrice,
      monitorQuery: `${route.description} ${route.line ?? ''}`,
      sourceSlug: route.sourceSlug,
      outcomeSide: betOutcomeSide(route) ?? undefined,
      ...trackedPositionFields(route, amount, openedAt),
    }, {
      onSuccess: () => {
        setTrackingId(null);
        // Acquiring is the commitment: this is where a searched-for goal becomes a
        // goal the user actually has, and joins the Goals tab.
        if (sessionGoalId) confirmGoal(sessionGoalId);
        void openTradeDestination(route, destination);
      },
    });
  }

  if (shouldFetch && isLoading && !error) {
    return <Screen><AnalyzingLoader /></Screen>;
  }
  if (quizLoading) {
    return <BrandLoader subtitle="Loading your saved quiz…" />;
  }
  if (history.length === 0 && !isGenerating && routes.length === 0 && !error) {
    return <EmptyRoutes
      hasSavedQuiz={!!quizAnswers}
      onStart={() => router.push(quizAnswers ? '/(tabs)/routes?generate=1' : '/quiz')}
    />;
  }

  const goal = sessionParams ? {
    target: sessionParams.target,
    when: timeframeLabel(sessionParams.timeframe),
  } : null;
  const visibleRoutes = filtered.slice(0, visibleCount);

  const renderRoute = (route: Route): React.ReactElement | null => {
    const destination = preferredTradeDestination(route, sessionParams?.preferredPlatforms);
    return (
      <View key={route.id} className="gap-0.5">
        <RouteCard
          route={route}
          requiredInvestment={results?.requiredInvestmentById.get(route.id)}
          currentInvestment={results?.selectedStake(route)}
          onTrack={trackingId === null ? () => {
            setTrackingId(route.id);
            setTrackingAmount(String(results?.selectedStake(route) ?? referenceStake));
          } : undefined}
          onPress={() => router.push(`/route/${route.id}?stake=${results?.selectedStake(route) ?? referenceStake}&available=${displayedInvestment}`)}
        />
        {trackingId === route.id && (
          <TrackRouteForm
            amount={trackingAmount}
            destinationLabel={tradeDestinationLabel(destination)}
            onAmountChange={setTrackingAmount}
            onConfirm={() => confirmAcquire(route)}
            onCancel={() => setTrackingId(null)}
          />
        )}
      </View>
    );
  };

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
            referenceStake={referenceStake}
            routeCount={filtered.length}
            onAmountChange={setInvestmentAndReset}
            onNewSearch={() => router.push('/quiz')}
            onBackToLatest={() => router.replace('/(tabs)/routes')}
          />
        )}
        {ranked.length > 0 && (
          <RouteFilters
            filters={filters}
            categories={ranked.map((route) => route.category)}
            onChange={setFiltersAndReset}
            isSearching={search.isSearching}
            searchResultCount={search.routes.length}
          />
        )}
        {error && <RoutesError message={error} onRetry={refresh} />}
        {filters.groupByChance && predictionFacetsActive(filters)
          ? groupRoutesByChance(visibleRoutes).map((group) => (
            <View key={group.floor} className="gap-3">
              <ChanceGroupHeader label={group.label} routes={group.routes} />
              {group.routes.map(renderRoute)}
            </View>
          ))
          : visibleRoutes.map(renderRoute)}
        {visibleCount < filtered.length && (
          <Pressable onPress={() => setVisibleCount((count) => count + 30)} className="items-center active:opacity-70" style={{ borderRadius: Radius.md, paddingVertical: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.backgroundElement }}>
            <ThemedText style={{ fontSize: 13, fontWeight: '800', color: Brand[500] }}>Show 30 more · {filtered.length - visibleCount} remaining</ThemedText>
          </Pressable>
        )}
        {filtered.length === 0 && !isLoading && routes.length > 0 && <EmptyFiltered filters={filters} onClear={() => setFiltersAndReset(DEFAULT_FILTERS)} />}
        {routes.length > 0 && <ThemedText type="small" themeColor="textSecondary" className="text-center" style={{ opacity: 0.4 }}>{isHistorical ? 'Saved search · ' : ''}Pull down to refresh · AI-generated · For entertainment only</ThemedText>}
      </ScrollView>
    </Screen>
  );
}

/**
 * Header for a probability band. Reports the range actually present in the group
 * rather than the band's nominal bounds — "58-64%" is true of these routes, where
 * "35-64%" would only be true of the band.
 */
function ChanceGroupHeader({ label, routes }: { label: string; routes: Route[] }): React.ReactElement {
  const theme = useTheme();
  const chances = routes.map((route) => route.probability);
  const low = Math.min(...chances);
  const high = Math.max(...chances);
  const range = low === high ? `${low}%` : `${low}-${high}%`;

  return (
    <View className="flex-row items-center" style={{ gap: 8, paddingHorizontal: 4, paddingTop: 4 }}>
      <ThemedText style={{ fontSize: 11, fontWeight: '900', color: Brand[500], letterSpacing: 0.9 }}>
        {label.toUpperCase()}
      </ThemedText>
      <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>
        {range}
      </ThemedText>
      <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
      <ThemedText style={{ fontSize: 11, color: theme.textTertiary, fontVariant: ['tabular-nums'] }}>
        {routes.length} route{routes.length === 1 ? '' : 's'}
      </ThemedText>
    </View>
  );
}

function Screen({ children }: React.PropsWithChildren): React.ReactElement {
  const theme = useTheme();
  return <View className="flex-1" style={{ backgroundColor: theme.background }}><SafeAreaView className="flex-1">{children}</SafeAreaView></View>;
}

function EmptyRoutes({ hasSavedQuiz, onStart }: { hasSavedQuiz: boolean; onStart: () => void }): React.ReactElement {
  const theme = useTheme();
  return <Screen><View className="flex-1 justify-center px-6"><View className="items-center gap-4 py-10 px-6" style={{ borderRadius: Radius.xl, backgroundColor: theme.backgroundElevated, borderWidth: 1, borderColor: theme.border, ...Shadow.card }}><ThemedText style={{ fontSize: 40 }}>🎯</ThemedText><ThemedText style={{ fontSize: 22, fontWeight: '800', color: theme.text, textAlign: 'center' }}>Find prediction routes</ThemedText><ThemedText className="text-center" style={{ fontSize: 14, color: theme.textSecondary, lineHeight: 21, maxWidth: 300 }}>{hasSavedQuiz ? 'Use your saved goal and preferences to generate fresh routes.' : 'Set your goal and timeframe — we\'ll scan prediction markets and generate routes in one step.'}</ThemedText><Pressable onPress={onStart} className="self-stretch py-4 items-center active:opacity-85 mt-2" style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], ...Shadow.card }}><ThemedText style={{ fontSize: 16, fontWeight: '800', color: '#06140C' }}>{hasSavedQuiz ? 'Find routes from saved quiz →' : 'Set goal & search →'}</ThemedText></Pressable></View></View></Screen>;
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
