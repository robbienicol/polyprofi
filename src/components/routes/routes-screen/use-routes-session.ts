import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { timeframeCalendarDays } from '@/api/client/playbook';
import { useCardRewards } from '@/api/hooks/useCardRewards';
import { useQuizAnswers } from '@/api/hooks/useQuizAnswers';
import { useRoutes } from '@/api/hooks/useRoutes';
import { useSavedRoutes } from '@/api/hooks/useSavedRoutes';
import { useSavingsGoal } from '@/api/hooks/useSavingsGoal';
import { useSpendingCuts } from '@/api/hooks/useSpendingCuts';
import { appendNew } from '@/components/routes/routes-screen/routes-screen-helpers';
import { buildCardRewardRoutes } from '@/lib/card-reward-routes';
import { buildSpendingCutRoutes } from '@/lib/spending-cut-routes';
import type { Route, RouteParams } from '@/types/routes';

/**
 * The search the routes screen is showing: which batch, which goal, which numbers,
 * and the routes themselves. A new search (`generate=1`) is fetched and saved here;
 * a saved one is read back from history.
 */
export function useRoutesSession() {
  const router = useRouter();
  // The goal this search is for, handed over by the quiz. Historical batches carry
  // their own goalId instead.
  const { batchId, generate, goalId } = useLocalSearchParams<{ batchId?: string; generate?: string; goalId?: string }>();
  const { quizAnswers, isLoading: quizLoading } = useQuizAnswers();
  const { history, saveGeneratedRoutes } = useSavedRoutes();
  const { allGoals, confirmGoal } = useSavingsGoal();

  const viewedBatch = batchId ? history.find((batch) => batch.id === batchId) ?? null : null;
  const latestBatch = history[0] ?? null;
  const isGenerating = generate === '1';
  const isHistorical = viewedBatch !== null;
  // The search as it was run: what fetching and saving key on.
  const baseParams: RouteParams | null = isGenerating && quizAnswers
    ? quizAnswers
    : viewedBatch?.quizSnapshot ?? latestBatch?.quizSnapshot ?? null;
  // How much to make, dragged on the list. Tagged with the search's own target so a
  // new search starts from its own number instead of keeping the last drag.
  const [targetDrag, setTargetDrag] = useState<{ base: number; value: number } | null>(null);
  const targetOverride = baseParams && targetDrag && targetDrag.base === baseParams.target ? targetDrag.value : null;
  // Everything that scores, sizes or labels routes reads this one.
  const sessionParams: RouteParams | null = baseParams && targetOverride != null
    ? { ...baseParams, target: targetOverride }
    : baseParams;
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
  const shouldFetch = baseParams !== null && (isGenerating || manualRefresh);
  const { routes: fetchedRoutes, isLoading, isFetching, error, refresh } = useRoutes(baseParams, { enabled: shouldFetch });
  const generatedRoutes = isGenerating || (manualRefresh && fetchedRoutes.length > 0)
    ? fetchedRoutes
    : viewedBatch?.routes ?? recentRoutes ?? latestBatch?.routes ?? [];
  // Spending cuts are built here rather than fetched with the rest: they come from a
  // statement held on this device, so they never went to the server that generated the
  // pool, and they are re-derived against whichever goal is on screen instead of being
  // frozen into a saved batch. Everything downstream — scoring, filters, the card —
  // treats them as ordinary routes, which is the point of them being Routes at all.
  const { imported: importedCuts } = useSpendingCuts();
  // Card rewards come the same way, from the accounts linked through Plaid: which
  // card each dollar went on, against which card would have paid more for it.
  const { profile: cardProfile } = useCardRewards();
  const routes = sessionParams
    ? appendNew(generatedRoutes, [
      ...(importedCuts && importedCuts.cuts.length > 0
        ? buildSpendingCutRoutes({ cuts: importedCuts.cuts, target: sessionParams.target, deadlineDays: timeframeCalendarDays(sessionParams.timeframe) })
        : []),
      ...(cardProfile
        ? buildCardRewardRoutes({ profile: cardProfile, target: sessionParams.target, deadlineDays: timeframeCalendarDays(sessionParams.timeframe) })
        : []),
    ])
    : generatedRoutes;

  const savedGeneration = useRef<string | null>(null);

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

  async function handleRefresh(): Promise<void> {
    if (isHistorical || !baseParams) return;
    setManualRefresh(true);
    try {
      const refreshed = await refresh();
      if (refreshed.length > 0) {
        setRecentRoutes(refreshed);
        saveGeneratedRoutes(baseParams, refreshed, sessionGoalId);
      }
    } catch {
      // The query's own error state renders the retry card; nothing to add here.
    } finally {
      setManualRefresh(false);
    }
  }

  return {
    router,
    quizAnswers,
    quizLoading,
    history,
    viewedBatch,
    isGenerating,
    isHistorical,
    baseParams,
    sessionParams,
    setTargetDrag,
    sessionGoalId,
    allGoals,
    confirmGoal,
    manualRefresh,
    routes,
    isLoading,
    error,
    handleRefresh,
  };
}
