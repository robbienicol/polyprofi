import { useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';

import { resetOnboardingForDev } from '@/api/client/storage';

/**
 * Sends you back to the top of the first-run funnel: carousel, greeting, quiz,
 * build, plan reveal.
 *
 * Gated on `__DEV__`, so the button that calls it never renders in a release
 * build. It clears the local first-run keys and sets a replay flag that makes
 * the router ignore the server's `profile_completed_at` for one pass — without
 * that, signing back in would land straight on goal-setup and you would only
 * ever see the carousel. Goals, saved routes, and settings are left alone.
 */
export function useDevResetOnboarding(): {
  available: boolean;
  loading: boolean;
  run: () => Promise<void>;
} {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    if (!__DEV__ || loading) return;
    setLoading(true);
    try {
      await resetOnboardingForDev();
      // Both flags are cached, and the carousel reads the profile on mount —
      // without this it would open on the stale name and a ticked consent box.
      await queryClient.invalidateQueries();
      router.replace('/onboarding' as Href);
    } finally {
      setLoading(false);
    }
  }, [loading, queryClient, router]);

  return { available: __DEV__, loading, run };
}
