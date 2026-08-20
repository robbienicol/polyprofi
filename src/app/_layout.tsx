import '@/global.css';

import { ClerkProvider } from '@clerk/clerk-expo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { Stack, router, usePathname, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useGoalMaintenance } from '@/api/hooks/useGoalMaintenance';
import { useSavingsGoal } from '@/api/hooks/useSavingsGoal';
import { AppLockGate } from '@/components/auth/AppLockGate';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';
import { clerkTokenCache } from '@/lib/clerk-cache';
import { shouldPresentCelebration } from '@/lib/savings-goal';

const queryClient = new QueryClient();
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

function useNotificationObserver() {
  useEffect(() => {
    function redirect(notification: Notifications.Notification) {
      const url = notification.request.content.data?.url;
      if (typeof url === 'string') router.push(url as Href);
    }

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        const notification = response?.notification;
        if (notification) redirect(notification);
      })
      .catch(() => {});

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      redirect(response.notification);
    });
    return () => subscription.remove();
  }, []);
}

/**
 * Presents the congratulations screen once a goal is reached, from anywhere in
 * the app. Driven by persisted goal state rather than by the notification tap, so
 * it works identically whether the user opens the notification, comes back to a
 * backgrounded app, or launches it cold days later.
 */
function GoalHousekeeping(): null {
  useGoalMaintenance();
  return null;
}

function GoalCelebrationGate(): null {
  const { pendingCelebration } = useSavingsGoal();
  const pathname = usePathname();
  const presentedGoalId = useRef<string | null>(null);

  useEffect(() => {
    if (!shouldPresentCelebration({ goal: pendingCelebration, pathname, presentedGoalId: presentedGoalId.current })) {
      return;
    }
    presentedGoalId.current = pendingCelebration?.id ?? null;
    // The goal travels as an argument: the screen congratulates the goal it was
    // opened for, not whatever is pending by the time it renders.
    router.push(`/goal-achieved?goalId=${pendingCelebration?.id ?? ''}` as Href);
  }, [pendingCelebration, pathname]);

  return null;
}

export default function RootLayout(): React.ReactElement {
  useColorScheme(); // subscribe to color scheme changes
  useNotificationObserver();
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ClerkProvider publishableKey={publishableKey} tokenCache={clerkTokenCache}>
          <QueryClientProvider client={queryClient}>
            <AppLockGate>
              <Stack screenOptions={{ headerShown: false }} />
              <GoalCelebrationGate />
              <GoalHousekeeping />
              <OfflineBanner />
            </AppLockGate>
          </QueryClientProvider>
        </ClerkProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
