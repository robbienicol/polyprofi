import { useQuery } from '@tanstack/react-query';

import { resolveMarketComparison } from '@/lib/market-comparison';
import type { Route } from '@/types/routes';

export function useMarketComparison(route: Route | undefined) {
  const enabled = !!route?.sourceSlug;
  const { data, isLoading } = useQuery({
    queryKey: ['MARKET_COMPARISON', route?.sourceSlug, route?.line],
    queryFn: () => resolveMarketComparison(route!),
    enabled,
    staleTime: 30_000,
    retry: false,
  });

  return { comparison: data ?? null, isLoading: enabled && isLoading };
}
