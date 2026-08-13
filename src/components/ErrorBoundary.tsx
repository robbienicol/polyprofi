import React, { Component, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * A Clerk instance whose frontend domain doesn't resolve fails here rather than on
 * the sign-in screen, which used to surface as a bare "Something went wrong".
 */
function isClerkLoadFailure(error: Error): boolean {
  return /failed_to_load_clerk_js|failed to load clerk/i.test(error.message);
}

/** Fallback UI shown when a screen crashes, so the whole app doesn't go blank. */
function ErrorFallback({ error, onRetry }: { error: Error; onRetry: () => void }): React.ReactElement {
  const theme = useTheme();
  const clerkDown = isClerkLoadFailure(error);
  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <SafeAreaView className="flex-1 items-center justify-center px-8 gap-4">
        <ThemedText style={{ fontSize: 40 }}>{clerkDown ? '📡' : '⚠️'}</ThemedText>
        <ThemedText style={{ fontSize: 18, fontWeight: '800', color: theme.text, textAlign: 'center' }}>
          {clerkDown ? 'Can’t reach sign-in' : 'Something went wrong'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', maxWidth: 280 }}>
          {clerkDown
            ? 'We couldn’t load the sign-in service. Check your connection and try again.'
            : 'Pathey hit an unexpected error. Try again, and if it keeps happening, restart the app.'}
        </ThemedText>
        {clerkDown && __DEV__ && (
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', maxWidth: 300, opacity: 0.5 }}>
            Dev hint: EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY points at a Clerk domain that isn’t resolving.
          </ThemedText>
        )}
        <Pressable
          onPress={onRetry}
          className="mt-2 px-6 py-3 active:opacity-80"
          style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], ...Shadow.card }}>
          <ThemedText style={{ fontWeight: '800', fontSize: 15, color: '#06140C' }}>Try again</ThemedText>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

/**
 * Root-level error boundary. Catches render errors anywhere below it and
 * shows a recoverable fallback instead of letting the whole app go blank/crash.
 * Only class components can implement getDerivedStateFromError/componentDidCatch.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }): void {
    console.error('Unhandled error in app tree:', error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}
