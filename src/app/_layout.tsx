import '@/global.css';
import 'react-native-gesture-handler';

import {
  PublicSans_400Regular,
  PublicSans_500Medium,
  PublicSans_600SemiBold,
  PublicSans_700Bold,
  PublicSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/public-sans';
import {
  SourceSerif4_600SemiBold,
  SourceSerif4_700Bold,
} from '@expo-google-fonts/source-serif-4';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { Stack, router, useRootNavigationState, usePathname, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useGoalMaintenance } from '@/api/hooks/useGoalMaintenance';
import { useSavingsGoal } from '@/api/hooks/useSavingsGoal';
import { AppLockGate } from '@/components/auth/AppLockGate';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';
import { getQueryClient } from '@/api/query-client';
import { pullUserData, setSyncSession } from '@/api/client/user-data-sync';
import { clerkTokenCache } from '@/lib/clerk-cache';
import { useGainAlerts } from '@/api/hooks/useGainAlerts';
import { shouldPresentCelebration } from '@/lib/savings-goal';

SplashScreen.preventAutoHideAsync().catch(() => {});

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

/**
 * Opens the screen a tapped notification points at. Waits for the root navigator:
 * on a cold start from a notification the layout first renders nothing while fonts
 * load, and a push before the Stack exists throws (and was silently caught). The
 * launch response is cleared once handled, or every later launch replayed it.
 */
function NotificationObserver(): null {
  const navigationReady = Boolean(useRootNavigationState()?.key);

  useEffect(() => {
    if (!navigationReady) return;
    function redirect(notification: Notifications.Notification) {
      const url = notification.request.content.data?.url;
      if (typeof url === 'string') router.push(url as Href);
    }

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        const notification = response?.notification;
        if (!notification) return;
        Notifications.clearLastNotificationResponse();
        redirect(notification);
      })
      .catch(() => {});

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      redirect(response.notification);
    });
    return () => subscription.remove();
  }, [navigationReady]);

  return null;
}

/**
 * Presents the congratulations screen once a goal is reached, from anywhere in
 * the app. Driven by persisted goal state rather than by the notification tap, so
 * it works identically whether the user opens the notification, comes back to a
 * backgrounded app, or launches it cold days later.
 */
function GoalHousekeeping(): null {
  useGoalMaintenance();
  // Rides the portfolio refresh that is already running, and sends at most one
  // piece of good news a day. Mounted here so it works whichever tab is open.
  useGainAlerts();
  return null;
}

/** React Query key of the hook that reads each synced blob, to refresh after a pull. */
const SYNCED_QUERY_KEYS = {
  bets: ['TRACKED_BETS'],
  savedRoutes: ['SAVED_ROUTES'],
  preferences: ['PREFERENCES'],
  onboardingProfile: ['ONBOARDING_PROFILE'],
  portfolioProgress: ['PORTFOLIO_PROGRESS'],
} as const;

/**
 * Mirrors bets, saved routes, settings and history to the signed-in account.
 * Runs once per sign-in and again on reconnect, which is when changes made
 * offline finally reach the server.
 */
function UserDataSync(): null {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const queryClient = useQueryClient();
  const signedIn = isLoaded && !!isSignedIn && !!userId;

  useEffect(() => {
    if (isLoaded && !signedIn) setSyncSession(null);
  }, [isLoaded, signedIn]);

  useQuery({
    queryKey: ['USER_DATA_SYNC', userId],
    enabled: signedIn,
    queryFn: async () => {
      const changed = await pullUserData({ userId: userId!, getToken });
      await Promise.all(changed.map((key) => queryClient.invalidateQueries({ queryKey: SYNCED_QUERY_KEYS[key] })));
      return changed;
    },
    staleTime: Infinity,
    refetchOnReconnect: 'always',
  });

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

export default function RootLayout(): React.ReactElement | null {
  useColorScheme(); // subscribe to color scheme changes
  const queryClient = getQueryClient();

  // Both faces ship with the bundle, so this resolves on the first frame after
  // load; holding the splash avoids a visible reflow of every line of text.
  const [fontsLoaded, fontError] = useFonts({
    SourceSerif4_600SemiBold,
    SourceSerif4_700Bold,
    PublicSans_400Regular,
    PublicSans_500Medium,
    PublicSans_600SemiBold,
    PublicSans_700Bold,
    PublicSans_800ExtraBold,
  });

  useEffect(() => {
    // A font that fails to load is not worth a stuck splash — fall back to system.
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ClerkProvider publishableKey={publishableKey} tokenCache={clerkTokenCache}>
            <QueryClientProvider client={queryClient}>
              <AppLockGate>
                <Stack screenOptions={{ headerShown: false }} />
                <NotificationObserver />
                <GoalCelebrationGate />
                <GoalHousekeeping />
                <UserDataSync />
                <OfflineBanner />
              </AppLockGate>
            </QueryClientProvider>
          </ClerkProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
