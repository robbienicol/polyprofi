import { useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchRoutes } from '@/api/client/anthropic';
import { Route, RouteParams } from '@/types/routes';

function routesQueryKey(params: RouteParams | null) {
  if (!params) return ['ROUTES'] as const;
  return [
    'ROUTES',
    params.balance,
    params.target,
    params.timeframe,
    [...(params.categories ?? [])].sort().join('|'),
    params.riskTolerance ?? 'balanced',
    params.maxRiskLevel,
    params.minProbability,
  ] as const;
}

export function useRoutes(params: RouteParams | null, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const queryKey = routesQueryKey(params);
  const shouldFetch = !!params && (options?.enabled ?? false);
  const { data, status, isFetching, error: queryError } = useQuery<Route[], Error>({
    queryKey,
    queryFn: () => params ? fetchRoutes(params) : Promise.resolve([]),
    enabled: shouldFetch,
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnMount: false,
  });

  const refresh = async () => {
    if (!params) return [];
    const routes = await fetchRoutes(params, { force: true });
    queryClient.setQueryData(queryKey, routes);
    return routes;
  };

  return {
    routes: data ?? [],
    isLoading: status === 'pending' && shouldFetch,
    isFetching,
    error: status === 'error' ? (queryError?.message ?? 'Failed to generate routes. Try refreshing.') : null,
    refresh,
  };
}
