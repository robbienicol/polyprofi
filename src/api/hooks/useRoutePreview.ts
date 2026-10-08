import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { deviceQuery } from '@/api/query-client';
import type { SavedRoutesBatch } from '@/types/routes';

function routePreviewQueryKey() {
  return ['ROUTE_PREVIEW'] as const;
}

/**
 * The list context behind the row the user just tapped.
 *
 * The routes list is wider than what was saved: a keyword search merges live
 * Polymarket and curated-asset hits into the pool, and those never go through
 * `saveGeneratedRoutes`. The detail screen looks a route up in saved history, so
 * tapping one of those hits landed on "This pick is no longer available". The
 * list hands its pool and session over here on the tap instead, and the detail
 * screen falls back to it.
 *
 * In-memory on purpose — it describes the list on screen right now, not
 * something worth carrying across launches.
 */
export function useRoutePreview() {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: routePreviewQueryKey(),
    // Never runs: the data only ever arrives from `setPreview`, and it is never stale.
    queryFn: (): SavedRoutesBatch | null => null,
    initialData: (): SavedRoutesBatch | null => null,
    ...deviceQuery,
  });

  const setPreview = useCallback((batch: SavedRoutesBatch) => {
    queryClient.setQueryData(routePreviewQueryKey(), batch);
  }, [queryClient]);

  return { preview: data ?? null, setPreview };
}
