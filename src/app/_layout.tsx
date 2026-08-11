import '@/global.css';

import { ClerkProvider } from '@clerk/clerk-expo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { Stack, router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppLockGate } from '@/components/auth/AppLockGate';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';
import { clerkTokenCache } from '@/lib/clerk-cache';

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
              <OfflineBanner />
            </AppLockGate>
          </QueryClientProvider>
        </ClerkProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
