import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { getPreferences, updatePreferences } from '@/api/client/storage';
import {
  DEFAULT_PREFERENCES,
  formatMoney,
  type MoneyOptions,
  type Preferences,
} from '@/lib/preferences';

function preferencesQueryKey() {
  return ['PREFERENCES'] as const;
}

/**
 * App settings with an optimistic write, so a Switch flips on the same frame it
 * is tapped instead of waiting on AsyncStorage.
 */
export function usePreferences() {
  const queryClient = useQueryClient();

  const { data, status } = useQuery({
    queryKey: preferencesQueryKey(),
    queryFn: getPreferences,
  });

  const { mutate: update } = useMutation({
    mutationFn: (patch: Partial<Preferences>) => updatePreferences(patch),
    onMutate: (patch) => {
      queryClient.setQueryData(preferencesQueryKey(), (previous: Preferences | undefined) => ({
        ...(previous ?? DEFAULT_PREFERENCES),
        ...patch,
      }));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: preferencesQueryKey() }),
  });

  return {
    preferences: data ?? DEFAULT_PREFERENCES,
    isLoading: status === 'pending',
    update,
  };
}

/** Formats money in the user's chosen display currency. */
export function useMoney(): (amount: number, options?: MoneyOptions) => string {
  const { preferences } = usePreferences();
  return useCallback(
    (amount: number, options?: MoneyOptions) => formatMoney(amount, preferences.currency, options),
    [preferences.currency],
  );
}
