import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePreferences } from '@/api/hooks/usePreferences';
import { useQuizAnswers } from '@/api/hooks/useQuizAnswers';
import { useRoutes } from '@/api/hooks/useRoutes';
import { usePredictionSearch } from '@/api/hooks/usePredictionSearch';
import { useAssetSearch } from '@/api/hooks/useAssetSearch';
import { useRoutePreview } from '@/api/hooks/useRoutePreview';
import { useSavedRoutes } from '@/api/hooks/useSavedRoutes';
import { useSavingsGoal } from '@/api/hooks/useSavingsGoal';
import { useCardRewards } from '@/api/hooks/useCardRewards';
import { useSpendingCuts } from '@/api/hooks/useSpendingCuts';
import { useTrackedBets } from '@/api/hooks/useTrackedBets';
import { MoreWaysToSave } from '@/components/routes/MoreWaysToSave';
import { RouteFilters } from '@/components/routes/RouteFilters';
import { RouteSearchBar } from '@/components/routes/RouteSearchBar';
import { RoutesHeader } from '@/components/routes/RoutesHeader';
import { TrackRouteForm } from '@/components/routes/TrackRouteForm';
import { RouteCard } from '@/components/molecules/RouteCard';
import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { AnalyzingLoader, BrandLoader } from '@/components/ui/loaders';
import { KEYBOARD_AWARE_SCROLL_PROPS } from '@/constants/keyboard';
import { Brand, OnBrand, Radius, Semantic, Shadow } from '@/constants/theme';
import { useSemanticText, useTheme } from '@/hooks/use-theme';
import { requestAppRating } from '@/lib/app-rating';
import { betOutcomeSide } from '@/lib/bet-monitor-match';
import { scheduleWeeklyReminder } from '@/lib/notifications';
import { parseEntryPrice } from '@/lib/parse-bet-line';
import { timeframeCalendarDays } from '@/api/client/playbook';
import { investmentSliderMaximum } from '@/lib/quiz-profile';
import { cancellationActionLabel, cancellationTargetFor } from '@/lib/cancel-links';
import { spendingCutPosition } from '@/lib/spending-cut-position';
import { openTradeDestination, preferredTradeDestination, tradeDestinationLabel } from '@/lib/route-actions';
import { activeKeyword, buildRouteResults, groupRoutesByChance, predictionFacetsActive, resolveInvestmentAmount, routeMatchesKeyword, searchOutcome, shouldOfferCapitalSafe } from '@/lib/route-results';
import type { GoalReach, RouteFilters as Filters } from '@/lib/route-results';
import { buildCardRewardRoutes } from '@/lib/card-reward-routes';
import { buildSpendingCutRoutes } from '@/lib/spending-cut-routes';
import { rescoreForStake } from '@/lib/stake-rescore';
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

const NO_ROUTES: Route[] = [];

/**
 * What the app just wrote down, in the user's words. Shown before any handoff, because
 * the alternative — write a position, switch to Safari, say nothing — is the single
 * worst moment in the flow for someone whose whole worry is being scammed.
 */
interface Receipt {
  routeId: string;
  /** Label / value pairs, read top to bottom. */
  lines: [string, string][];
  /** The venue handoff, offered rather than performed. Null when there is nowhere to go. */
  actionLabel: string | null;
  onAction: (() => void) | null;
}

export default function RoutesScreen(): React.ReactElement {
  const theme = useTheme();
  const semantic = useSemanticText();
  const router = useRouter();
  // The goal this search is for, handed over by the quiz. Historical batches carry
  // their own goalId instead.
  const { batchId, generate, goalId } = useLocalSearchParams<{ batchId?: string; generate?: string; goalId?: string }>();
  const { quizAnswers, isLoading: quizLoading } = useQuizAnswers();
  const { history, saveGeneratedRoutes } = useSavedRoutes();
  const { setPreview } = useRoutePreview();
  const { preferences } = usePreferences();
  const { allGoals, confirmGoal } = useSavingsGoal();
  const { trackBet, isTracking: isTrackingBet } = useTrackedBets();

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
  // A fresh search carries its goal in the URL or has none; it must not borrow the
  // previous search's goal while its own batch is still being saved.
  const batchGoalId = goalId ?? (isGenerating ? undefined : viewedBatch?.goalId ?? latestBatch?.goalId);
  const sessionGoalId = batchGoalId && allGoals.some((goal) => goal.id === batchGoalId)
    ? batchGoalId
    : undefined;

  const [manualRefresh, setManualRefresh] = useState(false);
  const [recentRoutes, setRecentRoutes] = useState<Route[] | null>(null);
  const shouldFetch = sessionParams !== null && (isGenerating || manualRefresh);
  const { routes: fetchedRoutes, isLoading, isFetching, error, refresh } = useRoutes(sessionParams, { enabled: shouldFetch });
  // Memoised because the keyword-search pool below derives from it: a fresh array
  // every render would rebuild that pool every render.
  const generatedRoutes = useMemo(
    // A pull-to-refresh keeps the list it already has on screen until the new one
    // arrives; only a fresh search starts from an empty, loading list.
    () => (isGenerating || (manualRefresh && fetchedRoutes.length > 0)
      ? fetchedRoutes
      : viewedBatch?.routes ?? recentRoutes ?? latestBatch?.routes ?? []),
    [isGenerating, manualRefresh, fetchedRoutes, viewedBatch?.routes, recentRoutes, latestBatch?.routes],
  );
  // Spending cuts are built here rather than fetched with the rest: they come from a
  // statement held on this device, so they never went to the server that generated the
  // pool, and they are re-derived against whichever goal is on screen instead of being
  // frozen into a saved batch. Everything downstream — scoring, filters, the card —
  // treats them as ordinary routes, which is the point of them being Routes at all.
  const { imported: importedCuts } = useSpendingCuts();
  // Card rewards come the same way, from the accounts linked through Plaid: which
  // card each dollar went on, against which card would have paid more for it.
  const { profile: cardProfile } = useCardRewards();
  const routes = useMemo(() => {
    if (!sessionParams) return generatedRoutes;
    const deadlineDays = timeframeCalendarDays(sessionParams.timeframe);
    const cutRoutes = importedCuts && importedCuts.cuts.length > 0
      ? buildSpendingCutRoutes({ cuts: importedCuts.cuts, target: sessionParams.target, deadlineDays })
      : [];
    const cardRoutes = cardProfile
      ? buildCardRewardRoutes({ profile: cardProfile, target: sessionParams.target, deadlineDays })
      : [];
    if (cutRoutes.length === 0 && cardRoutes.length === 0) return generatedRoutes;
    const known = new Set(generatedRoutes.map((route) => route.id));
    return [...generatedRoutes, ...[...cutRoutes, ...cardRoutes].filter((route) => !known.has(route.id))];
  }, [cardProfile, generatedRoutes, importedCuts, sessionParams]);

  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [trackingAmount, setTrackingAmount] = useState('');
  // What was just written, held until the user has read it. Nothing opens a trading
  // venue on its own any more: the app takes an action, says what it recorded, and
  // then offers the handoff as a separate tap.
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  // How much of a category the user says they will actually give up. Defaults to the
  // same share the card was priced at, so confirming without touching it is a no-op.
  const [cutPercent, setCutPercent] = useState(25);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [investment, setInvestment] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(30);
  const savedGeneration = useRef<string | null>(null);

  useEffect(() => {
    scheduleWeeklyReminder();
  }, []);

  // Asked after a route has actually been added — the one moment the app has done
  // something for this user — and never during the wait before it has answered a
  // single question. Guarded so it fires once per session rather than per receipt.
  const ratedThisSession = useRef(false);

  useEffect(() => {
    if (!isGenerating || isLoading || isFetching || !quizAnswers || fetchedRoutes.length === 0) return;
    // The goal is part of the key: a second goal's search can return the same daily
    // pool, and it still has to be saved as that goal's batch.
    const generationKey = `${goalId ?? 'none'}-${fetchedRoutes.length}-${fetchedRoutes[0].id}-${quizAnswers.target}-${quizAnswers.timeframe}`;
    if (savedGeneration.current === generationKey) return;
    savedGeneration.current = generationKey;
    setRecentRoutes(fetchedRoutes);
    saveGeneratedRoutes(quizAnswers, fetchedRoutes, goalId);
    // Drop generate=1 so a remount doesn't re-search, but keep the goal: the saved
    // batch that carries it may not have landed in the cache yet.
    router.replace((goalId ? `/(tabs)/routes?goalId=${goalId}` : '/(tabs)/routes') as Href);
  }, [goalId, fetchedRoutes, isFetching, isGenerating, isLoading, quizAnswers, router, saveGeneratedRoutes]);

  const referenceStake = sessionParams?.balance ?? 1_000;
  // What the user told the profile survey they can put in beats a stake inferred from
  // the goal — a $100 goal derives $1,000 no matter how much they actually have.
  const investmentDefault = sessionParams?.investmentCeiling ?? referenceStake;
  const displayedInvestment = resolveInvestmentAmount(investment, investmentDefault);
  const investmentMaximum = investmentSliderMaximum(referenceStake, sessionParams?.investmentCeiling);

  function setInvestmentAndReset(amount: number): void {
    setInvestment(Math.max(0, Math.round(amount)));
    setVisibleCount(30);
  }
  function setFiltersAndReset(next: Filters): void {
    setFilters(next);
    setVisibleCount(30);
  }

  // Keyword search reaches past this goal's pool on both sides of the map — the whole
  // Polymarket catalog, and the whole curated fund/coin universe — so its hits are
  // merged in before scoring. Ids already present win, so a market that is both
  // searched and already a route is not duplicated.
  const keyword = activeKeyword(filters);
  const predictionSearch = usePredictionSearch(keyword, sessionParams);
  const assetSearch = useAssetSearch(keyword, sessionParams);
  // Gamma's search is lenient — it ORs the words, so "zorble quantis" comes back with
  // a hundred markets matching neither. The strict local match is what the list
  // actually shows, so it is also what gets merged and counted: a "149 pulled in"
  // line above an empty list is worse than no line at all.
  const searchRoutes = useMemo(
    () => (keyword
      ? [...predictionSearch.routes, ...assetSearch.routes].filter((route) => routeMatchesKeyword(route, keyword))
      : []),
    [keyword, predictionSearch.routes, assetSearch.routes],
  );
  const searchPool = useMemo(() => {
    if (searchRoutes.length === 0) return routes;
    const known = new Set(routes.map((route) => route.id));
    return [...routes, ...searchRoutes.filter((route) => !known.has(route.id))];
  }, [routes, searchRoutes]);

  // The user's own weighting of the four score components. Held in preferences, not
  // screen state: someone who has said they cannot afford to lose the stake means it
  // on their next search too. Editing it lives in Settings now — this screen only
  // reads it to rank the list.
  const scoreWeights = preferences.scoreWeights;

  // Collapsed by default so the list is what's on screen once loading ends,
  // not a stack of controls above it. The count on the toggle is what tells
  // someone their filters are still applied while it's closed.
  const [showFilters, setShowFilters] = useState(false);
  const activeFilterCount = [
    filters.category !== null,
    filters.lossProfile !== null,
    filters.minimumProbability > 0,
    filters.sort !== 'score',
    filters.predictionTopic !== null,
    filters.maxDaysToResolve != null,
    filters.groupByChance,
  ].filter(Boolean).length;

  // Memoised: this rescores, scores and ranks the entire pool, and it used to run on
  // every render — including every event the investment slider fires while being
  // dragged, which is what made that slider feel unresponsive.
  const results = useMemo(
    () => (sessionParams
      ? buildRouteResults(searchPool, sessionParams, displayedInvestment, filters, scoreWeights)
      : null),
    [searchPool, sessionParams, displayedInvestment, filters, scoreWeights],
  );
  const ranked = results?.ranked ?? [];
  const filtered = results?.filtered ?? [];
  const goalReach = results?.goalReach ?? null;
  const moreCuts = results?.moreCuts ?? NO_ROUTES;
  const isSearching = predictionSearch.isSearching || assetSearch.isSearching;
  // Matches before the filter chips narrow them: the gap between this and `filtered`
  // is what separates "we don't cover it" from "your filters are hiding it".
  const keywordMatches = keyword
    ? ranked.filter((route) => routeMatchesKeyword(route, keyword)).length
    : 0;
  const outcome = searchOutcome({
    keyword,
    matchCount: keywordMatches,
    shownCount: filtered.length,
    isSearching,
  });
  // Non-null only when the whole list is all-or-nothing *and* more capital would bring a
  // capital-preserving route back. That is a budget fact the user cannot otherwise see:
  // the safe routes were dropped as unaffordable, not missing from the market.
  const capitalSafeUnlock = results && shouldOfferCapitalSafe(filters, filtered, results.unlockCapitalSafeInvestment)
    ? results.unlockCapitalSafeInvestment
    : null;
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

  async function handleRefresh(): Promise<void> {
    if (isHistorical || !sessionParams) return;
    setManualRefresh(true);
    try {
      const refreshed = await refresh();
      if (refreshed.length > 0) {
        setRecentRoutes(refreshed);
        saveGeneratedRoutes(sessionParams, refreshed, sessionGoalId);
      }
    } catch {
      // The query's own error state renders the retry card; nothing to add here.
    } finally {
      setManualRefresh(false);
    }
  }

  /**
   * Hands the user the receipt for what was just written, and asks for a rating once
   * the app has finally done something worth rating. Nothing navigates away on its
   * own: `onAction` is a button they choose, not a side effect of confirming.
   */
  function showReceipt(next: Receipt): void {
    setReceipt(next);
    if (!ratedThisSession.current) {
      ratedThisSession.current = true;
      void requestAppRating();
    }
  }

  /**
   * Taking a cut, which is not an acquisition: nothing is staked, so `amountWagered`
   * is 0 and the position's value is the saving itself. A subscription is cancelled
   * once and worth its whole charge; a category is worth whatever share of it the
   * user just committed to, which is why the stored return is rescaled here rather
   * than copied off the card.
   */
  function confirmCut(route: Route, cut: NonNullable<Route['spendingCut']>): void {
    const subscription = cut.kind === 'subscription';
    trackBet(spendingCutPosition({
      route,
      cut,
      cutPercent,
      timeframe: sessionParams?.timeframe,
      goalId: sessionGoalId,
      target: sessionParams?.target,
    }), {
      onSuccess: () => {
        setTrackingId(null);
        setCutPercent(25);
        if (sessionGoalId) confirmGoal(sessionGoalId);
        // Only a subscription has somewhere to go. Cutting back on a category is a
        // promise to yourself, and opening a page for it would be theatre.
        showReceipt({
          routeId: route.id,
          lines: [
            [subscription ? 'Cancelling' : 'Cutting back on', route.description],
            ['Counts toward', `+$${(sessionParams?.target ?? 0).toLocaleString()}`],
            ['Staked', 'Nothing — this is money you keep'],
          ],
          actionLabel: subscription ? cutActionLabel(route) : null,
          onAction: subscription ? () => { void openTradeDestination(route, 'cancel'); } : null,
        });
      },
    });
  }

  /**
   * Taking a card-rewards route. Nothing is staked; the position is worth the rewards
   * the plan is expected to earn before the deadline, the same way a cut is worth
   * its saving. A new card opens its application once it is in the plan.
   */
  function confirmCardRewards(route: Route, plan: NonNullable<Route['cardRewards']>): void {
    trackBet({
      id: `${route.id}-${Date.now()}`,
      goalId: sessionGoalId,
      category: route.category,
      emoji: route.emoji,
      description: route.description,
      platform: route.platform,
      strategy: route.strategy,
      riskLevel: route.riskLevel,
      probability: route.probability,
      expectedReturn: route.expectedReturn,
      amountWagered: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
      profitGoal: sessionParams?.target || route.expectedReturn,
    }, {
      onSuccess: () => {
        setTrackingId(null);
        if (sessionGoalId) confirmGoal(sessionGoalId);
        showReceipt({
          routeId: route.id,
          lines: [
            ['Added to your plan', route.description],
            ['Expected to earn', `+$${route.expectedReturn.toLocaleString()} by your deadline`],
            ['Staked', 'Nothing — these are rewards on spending you already do'],
          ],
          actionLabel: plan.kind === 'new-card' ? 'Open the application' : null,
          onAction: plan.kind === 'new-card' ? () => { void openTradeDestination(route, 'apply'); } : null,
        });
      },
    });
  }

  function confirmAcquire(route: Route): void {
    if (route.spendingCut) {
      confirmCut(route, route.spendingCut);
      return;
    }
    if (route.cardRewards) {
      confirmCardRewards(route, route.cardRewards);
      return;
    }
    const amount = Number(trackingAmount);
    if (!Number.isFinite(amount) || amount <= 0 || isTrackingBet) return;
    const predictionMarket = /polymarket|prediction/i.test(`${route.category} ${route.platform}`);
    // The route's own exact price first: the line is rounded to the cent, and a position
    // opened at "98¢" prices its own P&L against a contract it never bought.
    const entryPrice = route.entryPrice
      ?? parseEntryPrice(route.line)
      ?? (predictionMarket && route.probability > 0 ? route.probability / 100 : undefined);
    const destination = preferredTradeDestination(route, sessionParams?.preferredPlatforms);
    const openedAt = new Date().toISOString();
    // The card's figures belong to the slider's stake. The acquire form is only
    // prefilled from it, so an edited amount would otherwise store a payout for a
    // stake the user never took — inflating this position's return, the portfolio's
    // expected profit, and its weighted return.
    // The listed route is already priced at its own stake, so that is the base the
    // edited amount scales from — not the search's reference stake.
    const listedStake = results?.selectedStake(route) ?? referenceStake;
    const [atAmount = route] = rescoreForStake([route], listedStake, amount, sessionParams?.target ?? 0);
    trackBet({
      id: `${route.id}-${Date.now()}`,
      // The position works toward the goal this search was run for.
      goalId: sessionGoalId,
      category: route.category,
      emoji: route.emoji,
      description: atAmount.description,
      platform: route.platform,
      strategy: route.strategy,
      riskLevel: route.riskLevel,
      probability: route.probability,
      expectedReturn: atAmount.expectedReturn,
      amountWagered: amount,
      status: 'active',
      createdAt: openedAt,
      profitGoal: sessionParams?.target || atAmount.expectedReturn,
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
        showReceipt({
          routeId: route.id,
          lines: [
            ['Added to your plan', atAmount.description],
            ['Staking', `$${amount.toLocaleString()}${route.line ? ` at ${route.line}` : ''}`],
            ['If it works', `+$${Math.round(atAmount.expectedReturn).toLocaleString()}`],
            ['If it does not', route.lossProfile === 'binary' ? `You lose the $${amount.toLocaleString()}. There is no middle outcome.` : 'You keep what the position is worth at the time.'],
          ],
          actionLabel: `Open ${tradeDestinationLabel(destination)}`,
          onAction: () => { void openTradeDestination(route, destination); },
        });
      },
    });
  }

  // The full-screen loader is for a new search. A refresh already has a list to show,
  // and replacing it with the loader after a cold start read as the screen resetting.
  if (isGenerating && isLoading && !error) {
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

  // The goal these routes serve, so the header can name what the user is choosing for.
  const activeGoal = sessionGoalId ? allGoals.find((entry) => entry.id === sessionGoalId) ?? null : null;
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

  /**
   * The confirm button's words for a subscription cut. Never promises a cancellation
   * the link cannot deliver — an unknown merchant says it is opening a search.
   */
  const cutActionLabel = (route: Route): string | null => {
    const cut = route.spendingCut;
    if (!cut || cut.kind !== 'subscription') return null;
    return cancellationActionLabel(cancellationTargetFor(cut.merchant), cut.merchant);
  };

  const renderRoute = (route: Route): React.ReactElement | null => {
    const destination = preferredTradeDestination(route, sessionParams?.preferredPlatforms);
    return (
      <View key={route.id} className="gap-0.5">
        <RouteCard
          route={route}
          requiredInvestment={results?.requiredInvestmentById.get(route.id)}
          currentInvestment={results?.selectedStake(route)}
          score={results?.scoreById.get(route.id)?.score ?? null}
          onTrack={trackingId === null ? () => {
            setTrackingId(route.id);
            setCutPercent(25);
            setTrackingAmount(String(results?.selectedStake(route) ?? referenceStake));
          } : undefined}
          onPress={() => {
            // Hand the detail screen the list it was tapped from. Search hits are
            // merged in live and never saved, so history alone cannot find them.
            if (sessionParams) {
              setPreview({
                id: `preview-${Date.now()}`,
                generatedAt: new Date().toISOString(),
                quizSnapshot: sessionParams,
                routes: searchPool,
                ...(sessionGoalId ? { goalId: sessionGoalId } : null),
              });
            }
            router.push(`/route/${route.id}?stake=${results?.selectedStake(route) ?? referenceStake}&available=${displayedInvestment}`);
          }}
        />
        {receipt?.routeId === route.id && (
          <TrackReceipt receipt={receipt} onDone={() => setReceipt(null)} />
        )}
        {trackingId === route.id && (
          <TrackRouteForm
            amount={trackingAmount}
            destinationLabel={cutActionLabel(route) ?? tradeDestinationLabel(destination)}
            onAmountChange={setTrackingAmount}
            onConfirm={() => confirmAcquire(route)}
            onCancel={() => setTrackingId(null)}
            cut={route.spendingCut}
            cardRewards={route.cardRewards}
            cutPercent={cutPercent}
            onCutPercentChange={setCutPercent}
          />
        )}
      </View>
    );
  };

  return (
    <Screen>
      {/* Pinned above the scroll rather than a stickyHeaderIndices entry — this card
          is conditional on `goal`, and an index-based pin would silently point at
          the wrong child the moment another conditional block above it changes. */}
      {goal && (
        <View className="px-4 pt-6 pb-3">
          <RoutesHeader
            goal={goal}
            historical={isHistorical}
            batchLabel={isHistorical && viewedBatch ? formatBatchLabel(viewedBatch) : null}
            routeCount={filtered.length}
            onNewSearch={() => router.push('/quiz')}
            onBackToLatest={() => router.replace('/(tabs)/routes')}
          />
        </View>
      )}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName={`px-4 pb-16 gap-3 ${goal ? 'pt-1' : 'pt-6'}`}
        {...KEYBOARD_AWARE_SCROLL_PROPS}
        refreshControl={<RefreshControl refreshing={(isFetching && !isLoading) || manualRefresh} onRefresh={handleRefresh} tintColor={Brand[500]} />}>
        <RouteSearchBar
          value={filters.keyword}
          onChange={(nextKeyword) => setFiltersAndReset({ ...filters, keyword: nextKeyword })}
          isSearching={isSearching}
          pulledInCount={searchRoutes.length}
        />
        {ranked.length > 0 && (
          <>
            <Pressable
              onPress={() => setShowFilters((open) => !open)}
              accessibilityRole="button"
              className="flex-row items-center justify-between active:opacity-70"
              style={{
                borderRadius: Radius.lg,
                borderWidth: 1,
                borderColor: activeFilterCount === 0 ? theme.border : Brand[500] + '3D',
                backgroundColor: theme.backgroundElement,
                paddingHorizontal: 14,
                paddingVertical: 12,
                gap: 10,
              }}>
              <View className="flex-1">
                <ThemedText style={{ fontSize: 13, fontWeight: '800', color: theme.text }}>
                  Filters
                </ThemedText>
                <ThemedText style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
                  {activeFilterCount === 0
                    ? 'How much to invest, asset class, chance and more'
                    : `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} active`}
                </ThemedText>
              </View>
              <ThemedText style={{ fontSize: 13, fontWeight: '800', color: semantic.brand }}>
                {showFilters ? 'Done' : 'Edit'}
              </ThemedText>
            </Pressable>
            {showFilters ? (
              <RouteFilters
                filters={filters}
                categories={ranked.map((route) => route.category)}
                onChange={setFiltersAndReset}
                amount={displayedInvestment}
                investmentMaximum={investmentMaximum}
                onAmountChange={setInvestmentAndReset}
              />
            ) : null}
          </>
        )}
        {error && <RoutesError message={error} onRetry={() => void handleRefresh()} />}
        {goalUnreachable && goalReach && sessionParams ? (
          <GoalUnreachable
            reach={goalReach}
            when={timeframeLabel(sessionParams.timeframe)}
            investing={displayedInvestment}
            hasFilters={activeFilterCount > 0}
            onRaiseInvestment={setInvestmentAndReset}
            onClearFilters={() => setFiltersAndReset({ ...DEFAULT_FILTERS, keyword: filters.keyword })}
            onChangeGoal={() => router.push('/quiz')}
          />
        ) : null}
        {capitalSafeUnlock != null && sessionParams && !goalUnreachable ? (
          <CapitalSafeNudge
            target={sessionParams.target}
            amount={capitalSafeUnlock}
            onRaiseInvestment={setInvestmentAndReset}
          />
        ) : null}
        {filters.groupByChance && predictionFacetsActive(filters)
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
        {moreCuts.length > 0 && (lastVisibleCutId == null || (filters.groupByChance && predictionFacetsActive(filters))) ? (
          <MoreWaysToSave cuts={moreCuts} renderRoute={renderRoute} />
        ) : null}
        {visibleCount < filtered.length && (
          <Pressable
            onPress={() => setVisibleCount((count) => count + 30)}
            accessibilityRole="button"
            accessibilityLabel={`Show 30 more routes. ${filtered.length - visibleCount} remaining.`}
            className="items-center justify-center active:opacity-70"
            style={{ borderRadius: Radius.md, minHeight: 48, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.backgroundElement }}>
            <ThemedText style={{ fontSize: 14, fontWeight: '800', color: semantic.brand }}>Show 30 more · {filtered.length - visibleCount} remaining</ThemedText>
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

/**
 * The verdict, when the answer is no.
 *
 * This is the state the product exists for. A goal that cannot be reached in the time
 * given is the one answer nobody else will give honestly, and before this existed the
 * screen fell through to the empty-filter card and rendered "No  routes" — the moment
 * the whole app is built around, shipping as a string-interpolation bug.
 *
 * It says the number, says how close the best route gets, and then offers only dials
 * the user actually owns: the amount, the filters, the goal itself. It never suggests
 * a riskier route as the way to close the gap.
 */
function GoalUnreachable({ reach, when, investing, hasFilters, onRaiseInvestment, onClearFilters, onChangeGoal }: {
  reach: GoalReach;
  when: string;
  investing: number;
  hasFilters: boolean;
  onRaiseInvestment: (amount: number) => void;
  onClearFilters: () => void;
  onChangeGoal: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const semantic = useSemanticText();
  const percent = Math.round(reach.proximity * 100);
  const closest = Math.round(reach.bestProjectedReturn);
  const moreHelps = reach.investmentToReach != null && reach.investmentToReach > investing;

  return (
    <View
      style={{
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Semantic.caution + '4D',
        backgroundColor: Semantic.caution + '14',
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 10,
      }}>
      <ThemedText style={{ fontSize: 18, fontWeight: '700', color: theme.text, lineHeight: 25 }}>
        {`Nothing reaches +$${reach.target.toLocaleString()} ${when}.`}
      </ThemedText>
      <ThemedText style={{ fontSize: 14, lineHeight: 21, color: theme.textSecondary }}>
        {closest > 0
          ? `The closest route gets you to +$${closest.toLocaleString()} — ${percent}% of it — at the $${investing.toLocaleString()} you're putting in.`
          : `At the $${investing.toLocaleString()} you're putting in, nothing here makes progress on it.`}
      </ThemedText>
      <ThemedText style={{ fontSize: 14, lineHeight: 21, color: theme.textSecondary }}>
        {moreHelps
          ? `$${reach.investmentToReach!.toLocaleString()} is where the first route reaches it. Below that, the math does not get there — whatever the risk.`
          : 'More money would not change it either. The honest options are a smaller number or a longer deadline.'}
      </ThemedText>
      <View className="flex-row flex-wrap" style={{ gap: 8, marginTop: 2 }}>
        {moreHelps ? (
          <Pressable
            onPress={() => onRaiseInvestment(reach.investmentToReach!)}
            accessibilityRole="button"
            accessibilityHint="Sets what you are willing to invest to that amount and re-ranks the list"
            className="active:opacity-85"
            style={{ borderRadius: Radius.md, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', backgroundColor: Brand[500] }}>
            <ThemedText style={{ fontSize: 14, fontWeight: '800', color: OnBrand }}>
              Invest up to ${reach.investmentToReach!.toLocaleString()}
            </ThemedText>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onChangeGoal}
          accessibilityRole="button"
          className="active:opacity-70"
          style={{ borderRadius: Radius.md, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: theme.borderControl }}>
          <ThemedText style={{ fontSize: 14, fontWeight: '800', color: theme.text }}>Change the goal</ThemedText>
        </Pressable>
        {hasFilters ? (
          <Pressable
            onPress={onClearFilters}
            accessibilityRole="button"
            accessibilityHint="Clears the filters. It will not bring a goal-reaching route back."
            className="active:opacity-70"
            style={{ paddingHorizontal: 8, minHeight: 44, justifyContent: 'center' }}>
            <ThemedText style={{ fontSize: 14, fontWeight: '700', color: semantic.brand }}>Clear filters</ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/**
 * What was just recorded, before anything opens. The app took an action with the
 * user's money; this is it saying so, in the same words the card used, with the
 * downside stated rather than implied. The handoff is a button here, not a side
 * effect of confirming — see `Receipt`.
 */
function TrackReceipt({ receipt, onDone }: { receipt: Receipt; onDone: () => void }): React.ReactElement {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`Added to your plan. ${receipt.lines.map(([label, value]) => `${label}: ${value}`).join('. ')}`}
      style={{
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Semantic.positive + '3D',
        backgroundColor: Semantic.positive + '12',
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 10,
      }}>
      <ThemedText style={{ fontSize: 15, fontWeight: '800', color: theme.text }}>Added to your plan</ThemedText>
      <View style={{ gap: 6 }}>
        {receipt.lines.map(([label, value]) => (
          <View key={label} style={{ gap: 1 }}>
            <ThemedText style={{ fontSize: 11, fontWeight: '800', color: theme.textSecondary, letterSpacing: 0.4 }}>
              {label.toUpperCase()}
            </ThemedText>
            <ThemedText style={{ fontSize: 14, lineHeight: 20, color: theme.text }}>{value}</ThemedText>
          </View>
        ))}
      </View>
      <View className="flex-row" style={{ gap: 8, marginTop: 2 }}>
        {receipt.actionLabel && receipt.onAction ? (
          <Pressable
            onPress={() => { receipt.onAction?.(); onDone(); }}
            accessibilityRole="button"
            accessibilityHint="Leaves Pathey and opens the venue in your browser"
            className="active:opacity-85"
            style={{ borderRadius: Radius.md, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', backgroundColor: Brand[500] }}>
            <ThemedText style={{ fontSize: 14, fontWeight: '800', color: OnBrand }}>{receipt.actionLabel} →</ThemedText>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onDone}
          accessibilityRole="button"
          className="active:opacity-70"
          style={{ borderRadius: Radius.md, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: theme.borderControl }}>
          <ThemedText style={{ fontSize: 14, fontWeight: '800', color: theme.text }}>Done</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * The line that closes the list. It was 40% opacity over secondary text — 1.7:1, the
 * least legible thing in the app — carrying the one disclosure on the screen that
 * ranks things. It reads at full strength now, and leads with what Pathey is rather
 * than with "AI-generated", which is the half most likely to be misread as a warning
 * about the numbers rather than a statement about how they were assembled.
 */
function RoutesDisclosure({ historical }: { historical: boolean }): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 3, paddingTop: 4 }}>
      <ThemedText style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, textAlign: 'center' }}>
        Not advice. Just the math.
      </ThemedText>
      <ThemedText style={{ fontSize: 12, lineHeight: 17, color: theme.textSecondary, textAlign: 'center' }}>
        {`${historical ? 'Saved search. ' : 'Pull down to refresh. '}Not financial advice. Figures are estimates, assembled with AI from live market data.`}
      </ThemedText>
    </View>
  );
}

/**
 * Shown when every route on screen is all-or-nothing and the reason is the budget rather
 * than the market.
 *
 * Without it the app reads as though contracts are all it deals in: the treasuries and
 * funds were priced out by `isRelevantRoute` and dropped in silence, so a user with $500
 * against a +$300 goal never learns that the safe options exist at all, let alone what
 * they cost. Naming the amount turns "this app only shows bets" into a number the user
 * can act on — and the button sets it, so the claim is testable in one tap.
 */
function CapitalSafeNudge({ target, amount, onRaiseInvestment }: {
  target: number;
  amount: number;
  onRaiseInvestment: (amount: number) => void;
}): React.ReactElement {
  const theme = useTheme();

  return (
    <View
      style={{
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Brand[500] + '3D',
        backgroundColor: Brand[500] + '0F',
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 8,
      }}>
      <ThemedText style={{ fontSize: 13, fontWeight: '800', color: theme.text }}>
        Everything here is all-or-nothing
      </ThemedText>
      <ThemedText style={{ fontSize: 12.5, lineHeight: 18, color: theme.textSecondary }}>
        {`Routes that keep your capital — treasuries and funds — need more of it to reach `
          + `+$${target.toLocaleString()}. $${amount.toLocaleString()} is where the first one hits your goal.`}
      </ThemedText>
      <Pressable
        onPress={() => onRaiseInvestment(amount)}
        accessibilityRole="button"
        accessibilityHint="Sets what you are willing to invest to that amount and re-ranks the list"
        className="self-start justify-center active:opacity-85"
        style={{ borderRadius: Radius.md, paddingHorizontal: 16, minHeight: 44, backgroundColor: Brand[500] }}>
        <ThemedText style={{ fontSize: 14, fontWeight: '800', color: OnBrand }}>
          Invest up to ${amount.toLocaleString()}
        </ThemedText>
      </Pressable>
    </View>
  );
}

/**
 * Header for a probability band. Reports the range actually present in the group
 * rather than the band's nominal bounds — "58-64%" is true of these routes, where
 * "35-64%" would only be true of the band.
 */
function ChanceGroupHeader({ label, routes }: { label: string; routes: Route[] }): React.ReactElement {
  const theme = useTheme();
  const semantic = useSemanticText();
  const chances = routes.map((route) => route.probability);
  const low = Math.min(...chances);
  const high = Math.max(...chances);
  const range = low === high ? `${low}%` : `${low}-${high}%`;

  return (
    <View className="flex-row items-center" style={{ gap: 8, paddingHorizontal: 4, paddingTop: 4 }}>
      <ThemedText style={{ fontSize: 11, fontWeight: '900', color: semantic.brand, letterSpacing: 0.9 }}>
        {label.toUpperCase()}
      </ThemedText>
      <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>
        {range}
      </ThemedText>
      <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
      <ThemedText style={{ fontSize: 11, color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>
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
  return <Screen><View className="flex-1 justify-center px-6"><View className="items-center gap-4 py-10 px-6" style={{ borderRadius: Radius.xl, backgroundColor: theme.backgroundElevated, borderWidth: 1, borderColor: theme.border, ...Shadow.card }}><Icon glyph="🎯" size={38} color={Brand[500]} strokeWidth={1.5} /><ThemedText style={{ fontSize: 22, fontWeight: '800', color: theme.text, textAlign: 'center' }}>Price every route to your goal</ThemedText><ThemedText className="text-center" style={{ fontSize: 14, color: theme.textSecondary, lineHeight: 21, maxWidth: 300 }}>{hasSavedQuiz ? 'Use your saved goal and preferences to price a fresh set of routes.' : 'Set your number and your deadline. We price every route to it — savings, treasuries, funds, coins, card rewards, spending cuts and prediction markets — and rank them safest first.'}</ThemedText><Pressable onPress={onStart} className="self-stretch py-4 items-center active:opacity-85 mt-2" style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], ...Shadow.card }}><ThemedText style={{ fontSize: 16, fontWeight: '800', color: OnBrand }}>{hasSavedQuiz ? 'Find routes from saved quiz →' : 'Set goal & search →'}</ThemedText></Pressable></View></View></Screen>;
}

function RoutesError({ message, onRetry }: { message: string; onRetry: () => void }): React.ReactElement {
  const theme = useTheme();
  return <View className="items-center gap-2 py-10 px-6" style={{ borderRadius: Radius.lg, backgroundColor: Semantic.negative + '12', borderWidth: 1, borderColor: Semantic.negative + '30' }}><Icon glyph="⚠️" size={23} color={Semantic.negative} /><ThemedText style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>Couldn&apos;t load routes</ThemedText><ThemedText className="text-center" style={{ fontSize: 13, color: theme.textSecondary }}>{message}</ThemedText><Pressable onPress={onRetry} accessibilityRole="button" className="active:opacity-70 mt-1 justify-center" style={{ borderRadius: Radius.md, paddingHorizontal: 20, minHeight: 44, backgroundColor: Brand[500] }}><ThemedText style={{ fontSize: 14, fontWeight: '700', color: OnBrand }}>Try again</ThemedText></Pressable></View>;
}

/**
 * A search that found nothing anywhere. This is a coverage answer, not a filter one:
 * clearing filters would not help, because there is no route behind them. Saying what
 * we DO cover is the useful half — "we don't have that" alone reads as a bug.
 *
 * Prediction markets are searched live across the whole Polymarket catalog, so a miss
 * there means the market genuinely doesn't exist or has already settled. Funds, stocks
 * and coins come from a curated universe, so a miss there means we deliberately don't
 * carry it — and that distinction is not worth explaining to the user mid-search.
 */
function EmptyUncovered({ keyword, onClear }: { keyword: string; onClear: () => void }): React.ReactElement {
  const theme = useTheme();
  const semantic = useSemanticText();
  return (
    <View className="items-center gap-2 py-10 px-6">
      <Icon glyph="🔍" size={25} color={theme.textSecondary} />
      <ThemedText type="smallBold" className="text-center">Nothing we can price for “{keyword}”</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" className="text-center" style={{ lineHeight: 19, maxWidth: 320 }}>
        We searched every open Polymarket contract plus the funds, stocks and coins we
        cover. Either no live market matches, or it&apos;s an asset we don&apos;t carry —
        we only route to things we can price honestly.
      </ThemedText>
      <Pressable
        onPress={onClear}
        accessibilityRole="button"
        className="active:opacity-60 justify-center"
        style={{ minHeight: 44, paddingHorizontal: 12 }}>
        <ThemedText type="small" style={{ color: semantic.brand, fontWeight: '700' }}>Clear search</ThemedText>
      </Pressable>
      <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 11 }}>
        Try a team, a person, a ticker, or what a fund holds.
      </ThemedText>
    </View>
  );
}

/**
 * Empty results. When the chance filter is what emptied the list, the honest advice is
 * rarely "clear your filters" — the high-chance routes are real, they just need more
 * capital than the user said they would put in. Offer the amount that brings one back.
 */
function EmptyFiltered({ filters, unlockAmount, onRaiseInvestment, onClear }: {
  filters: Filters;
  unlockAmount: number | null;
  onRaiseInvestment: (amount: number) => void;
  onClear: () => void;
}): React.ReactElement {
  const semantic = useSemanticText();
  /*
   * Every branch names the filter that emptied the list. Interpolating a possibly-null
   * category straight into the string is what produced "No  routes" — a double space
   * and no explanation — on the one screen whose job is to be legible when the answer
   * is bad news.
   */
  const title = filters.minimumProbability > 0
    ? `No routes with a ${filters.minimumProbability}% chance or better`
    : filters.category
      ? `No ${filters.category.toLowerCase()} routes match your filters`
      : 'Your filters are hiding every route';
  return (
    <View className="items-center gap-2 py-8 px-6">
      <ThemedText type="smallBold">{title}</ThemedText>
      {unlockAmount != null && (
        <>
          <ThemedText type="small" themeColor="textSecondary" className="text-center" style={{ lineHeight: 19 }}>
            A high chance of hitting the goal comes from safe, low-yield routes, and those need
            more capital. Raising what you&apos;re willing to invest to ${unlockAmount.toLocaleString()} brings one back.
          </ThemedText>
          <Pressable
            onPress={() => onRaiseInvestment(unlockAmount)}
            accessibilityRole="button"
            accessibilityHint="Sets what you are willing to invest to that amount and re-ranks the list"
            className="active:opacity-85 mt-1 justify-center"
            style={{ borderRadius: Radius.md, paddingHorizontal: 16, minHeight: 44, backgroundColor: Brand[500] }}>
            <ThemedText style={{ fontSize: 14, fontWeight: '800', color: OnBrand }}>
              Invest up to ${unlockAmount.toLocaleString()}
            </ThemedText>
          </Pressable>
        </>
      )}
      <Pressable
        onPress={onClear}
        accessibilityRole="button"
        className="active:opacity-60 justify-center"
        style={{ minHeight: 44, paddingHorizontal: 12 }}>
        <ThemedText type="small" style={{ color: semantic.brand, fontWeight: '700' }}>Clear filters</ThemedText>
      </Pressable>
    </View>
  );
}

function timeframeLabel(timeframe: RouteParams['timeframe']): string {
  return ({ today: 'today', week: 'this week', month: 'this month', '3months': 'in 3 months', '1year': 'this year', '5years': 'in 5 years' })[timeframe];
}

function formatBatchLabel(batch: SavedRoutesBatch): string {
  const generated = new Date(batch.generatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const percent = batch.quizSnapshot.balance > 0 ? ((batch.quizSnapshot.target / batch.quizSnapshot.balance) * 100).toFixed(0) : '0';
  return `Saved ${generated} · +${percent}% · ${timeframeLabel(batch.quizSnapshot.timeframe)}`;
}
