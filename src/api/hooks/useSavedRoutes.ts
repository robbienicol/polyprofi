import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { appendSavedRoutesBatch, getSavedRoutesHistory } from '@/api/client/storage';
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
  });

  const { mutate: saveBatch } = useMutation({
    mutationFn: (batch: SavedRoutesBatch) => appendSavedRoutesBatch(batch),
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
