import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { appendSavedRoutesBatch, getSavedRoutesHistory, MAX_SAVED_BATCHES } from '@/api/client/storage';
import { deviceQuery } from '@/api/query-client';
import { QuizAnswers } from '@/types/bets';
import { Route, SavedRoutesBatch } from '@/types/routes';

function savedRoutesQueryKey() {
  return ['SAVED_ROUTES'] as const;
}

export function useSavedRoutes() {
  const queryClient = useQueryClient();

  const { data: history, status } = useQuery({
    queryKey: savedRoutesQueryKey(),
    queryFn: getSavedRoutesHistory,
    ...deviceQuery,
  });

  const { mutate: saveBatch } = useMutation({
    mutationFn: (batch: SavedRoutesBatch) => appendSavedRoutesBatch(batch),
    // The newest batch is the one every screen reads back — positions.tsx takes
    // its fallback balance from history[0] the moment routes are generated — so
    // it goes in front of the list here rather than a disk round-trip later.
    onMutate: async (batch) => {
      await queryClient.cancelQueries({ queryKey: savedRoutesQueryKey() });
      const previous = queryClient.getQueryData<SavedRoutesBatch[]>(savedRoutesQueryKey()) ?? [];
      queryClient.setQueryData(savedRoutesQueryKey(), [batch, ...previous].slice(0, MAX_SAVED_BATCHES));
      return { previous };
    },
    onError: (_error, _batch, context) => {
      if (context) queryClient.setQueryData(savedRoutesQueryKey(), context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: savedRoutesQueryKey() }),
  });

  const saveGeneratedRoutes = useCallback((quizSnapshot: QuizAnswers, routes: Route[], goalId?: string) => {
    if (routes.length === 0) return;
    saveBatch({
      id: `${Date.now()}`,
      generatedAt: new Date().toISOString(),
      quizSnapshot,
      routes,
      ...(goalId ? { goalId } : null),
    });
  }, [saveBatch]);

  return {
    history: history ?? [],
    isLoading: status === 'pending',
    saveGeneratedRoutes,
  };
}
