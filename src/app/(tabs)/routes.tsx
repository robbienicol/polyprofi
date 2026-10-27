import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { useSetRoutePreview } from '@/api/hooks/useRoutePreview';
import { MoreWaysToSave } from '@/components/routes/MoreWaysToSave';
import { PortalBar, RouteFilters, SortBar } from '@/components/routes/RouteFilters';
import { RouteSearchBar } from '@/components/routes/RouteSearchBar';
import { RoutesHeader } from '@/components/routes/RoutesHeader';
import { TrackRouteForm } from '@/components/routes/TrackRouteForm';
import { ChanceGroupHeader } from '@/components/routes/routes-screen/ChanceGroupHeader';
import { RouteBudgetControls } from '@/components/routes/routes-screen/RouteBudgetControls';
import { EmptyFiltered, EmptyRoutes, EmptyUncovered, RoutesDisclosure, RoutesError, Screen } from '@/components/routes/routes-screen/RoutesEmptyStates';
import { CapitalSafeNudge, GoalUnreachable } from '@/components/routes/routes-screen/RoutesNotices';
import { activeFilterCount, cutActionLabel, DEFAULT_FILTERS, formatBatchLabel, PAGE_SIZE, panelFilterCount, stampedId, timeframeLabel } from '@/components/routes/routes-screen/routes-screen-helpers';
import { TrackReceipt } from '@/components/routes/routes-screen/TrackReceipt';
import { useRouteAcquire } from '@/components/routes/routes-screen/use-route-acquire';
import { useRouteResults } from '@/components/routes/routes-screen/use-route-results';
import { useRoutesSession } from '@/components/routes/routes-screen/use-routes-session';
import { RouteCard } from '@/components/molecules/RouteCard';
import { ThemedText } from '@/components/themed-text';
import { AnalyzingLoader, RoutesScreenSkeleton } from '@/components/ui/loaders';
import { useSlowToast } from '@/components/ui/Toast';
import { KEYBOARD_AWARE_SCROLL_PROPS } from '@/constants/keyboard';
import { Brand, Radius } from '@/constants/theme';
import { useSemanticText, useTheme } from '@/hooks/use-theme';
import { scheduleWeeklyReminder } from '@/lib/notifications';
import { groupRoutesByChance, predictionFacetsActive } from '@/lib/route-results';
import { preferredTradeDestination, tradeDestinationLabel } from '@/lib/route-actions';
import { withTabSkeleton } from '@/components/ui/with-tab-skeleton';
import type { Route } from '@/types/routes';

function RoutesScreen(): React.ReactElement {
  const theme = useTheme();
  const semantic = useSemanticText();
  const session = useRoutesSession();
  const { router, quizAnswers, history, viewedBatch, isGenerating, isHistorical, baseParams, sessionParams, sessionGoalId, routes, isLoading, error } = session;
  const setPreview = useSetRoutePreview();
  const list = useRouteResults({ baseParams, sessionParams, routes });
  const { filters, setFiltersAndReset, setInvestmentAndReset, displayedInvestment, referenceStake, results, ranked, filtered, goalReach, moreCuts, keyword, outcome, visibleCount } = list;
  const acquire = useRouteAcquire({ sessionParams, sessionGoalId, confirmGoal: session.confirmGoal, results, referenceStake });
  const { trackingId, receipt } = acquire;

  useEffect(() => {
    scheduleWeeklyReminder();
  }, []);

  // Collapsed by default so the list is what's on screen once loading ends,
  // not a stack of controls above it. The count on the toggle is what tells
  // someone their filters are still applied while it's closed.
  const [showFilters, setShowFilters] = useState(false);

  // Stable handlers, so RouteCard's memo holds: a chip tap re-renders this screen, and
  // fresh closures per card re-rendered all twelve cards before the chip could light
  // up. They read the latest state through a ref instead.
  const cardActions = useRef<{ track: (route: Route) => void; open: (route: Route) => void } | null>(null);
  useEffect(() => {
    cardActions.current = {
      track: acquire.startTracking,
      open: (route) => {
        // Hand the detail screen the list it was tapped from. Search hits are
        // merged in live and never saved, so history alone cannot find them.
        if (sessionParams) {
          setPreview({
            id: stampedId('preview'),
            generatedAt: new Date().toISOString(),
            quizSnapshot: sessionParams,
            routes: list.searchPool,
            ...(sessionGoalId ? { goalId: sessionGoalId } : null),
          });
        }
        router.push(`/route/${route.id}?stake=${results?.selectedStake(route) ?? referenceStake}&available=${displayedInvestment}`);
      },
    };
  });
  // A new search can take a while on a slow network; say so instead of looking stuck.
  useSlowToast(isGenerating && isLoading, 'Still pricing routes — live markets are slow right now…', 10_000);
  useSlowToast(keyword !== '' && list.isSearching, 'Still searching every market…', 5_000);
  const trackCard = (route: Route) => cardActions.current?.track(route);
  const openCard = (route: Route) => cardActions.current?.open(route);
  /*
   * The goal itself does not add up — not a filter problem, not a coverage problem.
   *
   * Stated above the list rather than only in place of it, because a list of near-misses
   * with no verdict on top leaves the user to work out "can I actually do this?" from
   * thirty cards. Suppressed during a keyword search: the user named a market, and
   * answering with a verdict on their goal is answering a question they did not ask.
   */
  const goalUnreachable = goalReach != null
    && !goalReach.reachable
    && goalReach.poolSize > 0
    && keyword === ''
    && !isLoading;

  // The full-screen loader is for a new search. A refresh already has a list to show,
  // and replacing it with the loader after a cold start read as the screen resetting.
  if (isGenerating && isLoading && !error) {
    return <Screen><AnalyzingLoader /></Screen>;
  }
  if (session.quizLoading) {
    return <Screen><RoutesScreenSkeleton /></Screen>;
  }
  if (history.length === 0 && !isGenerating && routes.length === 0 && !error) {
    return <EmptyRoutes
      hasSavedQuiz={!!quizAnswers}
      onStart={() => router.push(quizAnswers ? '/(tabs)/routes?generate=1' : '/quiz')}
    />;
  }

  // The goal these routes serve, so the header can name what the user is choosing for.
  const activeGoal = sessionGoalId ? session.allGoals.find((entry) => entry.id === sessionGoalId) ?? null : null;
  const goal = sessionParams ? {
    target: sessionParams.target,
    when: timeframeLabel(sessionParams.timeframe),
    label: activeGoal?.label ?? null,
    emoji: activeGoal?.emoji ?? null,
  } : null;
  const visibleRoutes = filtered.slice(0, visibleCount);
  // The folded cuts sit right under the last cut still in the list, where someone
  // reading cuts would look for more of them — or at the end when none made it.
  const lastVisibleCutId = [...visibleRoutes].reverse().find((route) => route.spendingCut)?.id ?? null;
  const groupedByChance = filters.groupByChance && predictionFacetsActive(filters);

  const renderRoute = (route: Route): React.ReactElement | null => {
    const destination = preferredTradeDestination(route, sessionParams?.preferredPlatforms);
    return (
      <View key={route.id} className="gap-0.5">
        <RouteCard
          route={route}
          requiredInvestment={results?.requiredInvestmentById.get(route.id)}
          currentInvestment={results?.selectedStake(route)}
          odds={results?.oddsById.get(route.id) ?? null}
          target={list.deferredParams?.target ?? null}
          onTrack={trackingId === null ? trackCard : undefined}
          onPress={openCard}
        />
        {receipt?.routeId === route.id && (
          <TrackReceipt receipt={receipt} onDone={() => acquire.setReceipt(null)} />
        )}
        {trackingId === route.id && (
          <TrackRouteForm
            amount={acquire.trackingAmount}
            destinationLabel={cutActionLabel(route) ?? tradeDestinationLabel(destination)}
            onAmountChange={acquire.setTrackingAmount}
            onConfirm={() => acquire.confirmAcquire(route)}
            onCancel={() => acquire.setTrackingId(null)}
            cut={route.spendingCut}
            cardRewards={route.cardRewards}
            cutPercent={acquire.cutPercent}
            onCutPercentChange={acquire.setCutPercent}
          />
        )}
      </View>
    );
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-4 pb-16 pt-4 gap-3"
        {...KEYBOARD_AWARE_SCROLL_PROPS}
        refreshControl={<RefreshControl refreshing={session.manualRefresh} onRefresh={session.handleRefresh} tintColor={Brand[500]} />}>
        {/* Scrolls with the list: the screen is for the routes, not the controls. */}
        {goal && isHistorical && (
          <RoutesHeader
            goal={goal}
            historical={isHistorical}
            batchLabel={isHistorical && viewedBatch ? formatBatchLabel(viewedBatch) : null}
            routeCount={filtered.length}
            onNewSearch={() => router.push('/quiz')}
            onBackToLatest={() => router.replace('/(tabs)/routes')}
          />
        )}
        <RouteSearchBar
          value={filters.keyword}
          onChange={(nextKeyword) => setFiltersAndReset({ ...filters, keyword: nextKeyword })}
          isSearching={list.isSearching}
          pulledInCount={list.searchRoutes.length}
        />
        {ranked.length > 0 && (
          <>
            <RouteBudgetControls
              sessionParams={sessionParams}
              baseParams={baseParams}
              onTargetChange={(base, amount) => {
                session.setTargetDrag({ base, value: Math.max(1, Math.round(amount)) });
                list.setVisibleCount(PAGE_SIZE);
              }}
              investment={displayedInvestment}
              investmentMaximum={list.investmentMaximum}
              onInvestmentChange={setInvestmentAndReset}
              maxLoss={list.displayedMaxLoss}
              onMaxLossChange={list.setMaxLossAndReset}
            />
            <PortalBar routes={ranked} filters={filters} onChange={setFiltersAndReset} />
            <SortBar
              sort={filters.sort}
              onSortChange={(sort) => setFiltersAndReset({ ...filters, sort })}
              filterCount={panelFilterCount(filters)}
              filtersOpen={showFilters}
              onToggleFilters={() => setShowFilters((open) => !open)}
            />
            {showFilters ? (
              <RouteFilters
                filters={filters}
                routes={ranked}
                shownCount={filtered.length}
                onChange={setFiltersAndReset}
                onDone={() => setShowFilters(false)}
              />
            ) : null}
          </>
        )}
        {error && <RoutesError message={error} onRetry={() => void session.handleRefresh()} />}
        {goalUnreachable && goalReach && sessionParams ? (
          <GoalUnreachable
            reach={goalReach}
            when={timeframeLabel(sessionParams.timeframe)}
            investing={displayedInvestment}
            hasFilters={activeFilterCount(filters) > 0}
            onRaiseInvestment={setInvestmentAndReset}
            onClearFilters={() => setFiltersAndReset({ ...DEFAULT_FILTERS, keyword: filters.keyword })}
            onChangeGoal={() => router.push('/quiz')}
          />
        ) : null}
        {list.capitalSafeUnlock != null && sessionParams && !goalUnreachable ? (
          <CapitalSafeNudge
            target={sessionParams.target}
            amount={list.capitalSafeUnlock}
            onRaiseInvestment={setInvestmentAndReset}
          />
        ) : null}
        {list.isUpdating ? (
          <View className="flex-row items-center justify-center" style={{ gap: 8, paddingVertical: 4 }}>
            <ActivityIndicator size="small" color={Brand[500]} />
            <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary }}>Updating routes…</ThemedText>
          </View>
        ) : null}
        <View style={{ gap: 12, opacity: list.isUpdating ? 0.45 : 1 }}>
        {groupedByChance
          ? groupRoutesByChance(visibleRoutes).map((group) => (
            <View key={group.floor} className="gap-3">
              <ChanceGroupHeader label={group.label} routes={group.routes} />
              {group.routes.map(renderRoute)}
            </View>
          ))
          : visibleRoutes.map((route) => (
            route.id === lastVisibleCutId && moreCuts.length > 0
              ? (
                <View key={route.id} className="gap-3">
                  {renderRoute(route)}
                  <MoreWaysToSave cuts={moreCuts} renderRoute={renderRoute} />
                </View>
              )
              : renderRoute(route)
          ))}
        </View>
        {moreCuts.length > 0 && (lastVisibleCutId == null || groupedByChance) ? (
          <MoreWaysToSave cuts={moreCuts} renderRoute={renderRoute} />
        ) : null}
        {visibleCount < filtered.length && (
          <Pressable
            onPress={() => list.setVisibleCount((count) => count + PAGE_SIZE)}
            accessibilityRole="button"
            accessibilityLabel={`Show ${PAGE_SIZE} more routes. ${filtered.length - visibleCount} remaining.`}
            className="items-center justify-center active:opacity-70"
            style={{ borderRadius: Radius.md, minHeight: 48, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.backgroundElement }}>
            <ThemedText style={{ fontSize: 14, fontWeight: '800', color: semantic.brand }}>Show {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more · {filtered.length - visibleCount} remaining</ThemedText>
          </Pressable>
        )}
        {outcome === 'searching' && filtered.length === 0 && (
          <ThemedText type="small" themeColor="textSecondary" className="text-center" style={{ paddingVertical: 24 }}>
            Searching for “{keyword}”…
          </ThemedText>
        )}
        {outcome === 'uncovered' && (
          <EmptyUncovered keyword={keyword} onClear={() => setFiltersAndReset({ ...filters, keyword: '' })} />
        )}
        {!goalUnreachable && (outcome === 'filtered-out' || (outcome === 'idle' && filtered.length === 0 && !isLoading && routes.length > 0)) && (
          <EmptyFiltered
            filters={filters}
            unlockAmount={results?.unlockInvestmentFor(filters.minimumProbability) ?? null}
            onRaiseInvestment={setInvestmentAndReset}
            onClear={() => setFiltersAndReset(DEFAULT_FILTERS)}
          />
        )}
        {routes.length > 0 && <RoutesDisclosure historical={isHistorical} />}
      </ScrollView>
    </Screen>
  );
}

export default withTabSkeleton(RoutesScreen, 'routes');
