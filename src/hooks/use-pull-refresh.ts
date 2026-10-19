import { useState } from 'react';

/**
 * Pull-to-refresh that spins only for a pull. Tied to a query's isFetching, the
 * spinner also dropped in on every background refresh — a spinner at the top of a
 * screen the user did not ask to reload, which reads as the screen being stuck.
 */
export function usePullRefresh(refresh: () => unknown): { refreshing: boolean; onRefresh: () => void } {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = () => {
    setRefreshing(true);
    void Promise.resolve()
      .then(refresh)
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
  };
  return { refreshing, onRefresh };
}
