import { useAuth } from '@clerk/clerk-expo';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authenticateWithBiometrics, useBiometricLock } from '@/api/hooks/useBiometricLock';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * How long the app can sit in the background before it relocks. Short trips out —
 * copying a code from Mail, an OS permission sheet, glancing at a notification —
 * shouldn't cost a Face ID prompt on the way back.
 */
const LOCK_GRACE_MS = 5 * 60 * 1000;

/**
 * Gates the app behind Face ID / Touch ID when the user has opted in (Profile settings).
 * Relocks on a cold start, and after the app has been backgrounded for longer than
 * LOCK_GRACE_MS, so a signed-in session can't be picked up by someone else who has
 * the unlocked phone.
 */
export function AppLockGate({ children }: { children: React.ReactNode }): React.ReactElement {
  const theme = useTheme();
  const { isSignedIn } = useAuth();
  const { isAvailable, isEnabled, isLoading } = useBiometricLock();
  const shouldLock = isSignedIn && isEnabled && isAvailable;

  const [unlocked, setUnlocked] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const promptedRef = useRef(false);
  const backgroundedAt = useRef<number | null>(null);

  const attemptUnlock = useCallback(async () => {
    setAuthenticating(true);
    const success = await authenticateWithBiometrics();
    setAuthenticating(false);
    if (success) setUnlocked(true);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      // 'inactive' also fires for the notification shade and system sheets, so only
      // a real trip to the background starts the clock.
      if (state === 'background') {
        backgroundedAt.current = Date.now();
        return;
      }
      if (state !== 'active') return;

      const since = backgroundedAt.current;
      backgroundedAt.current = null;
      if (since !== null && Date.now() - since > LOCK_GRACE_MS) {
        promptedRef.current = false;
        setUnlocked(false);
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (shouldLock && !unlocked && !promptedRef.current) {
      promptedRef.current = true;
      attemptUnlock();
    }
  }, [shouldLock, unlocked, attemptUnlock]);

  if (isLoading) return <>{children}</>;
  if (!shouldLock || unlocked) return <>{children}</>;

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <SafeAreaView className="flex-1 items-center justify-center gap-8 px-8">
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: Radius.xl,
            backgroundColor: Brand[500],
            alignItems: 'center',
            justifyContent: 'center',
            ...Shadow.float,
          }}>
          <ThemedText style={{ fontSize: 38, fontWeight: '900', color: '#06140C' }}>$</ThemedText>
        </View>

        <View className="items-center gap-2">
          <ThemedText style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>PolyProfit is locked</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Unlock with Face ID to continue</ThemedText>
        </View>

        <Pressable
          onPress={attemptUnlock}
          disabled={authenticating}
          className="py-4 px-8 items-center active:opacity-80"
          style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], opacity: authenticating ? 0.6 : 1, ...Shadow.card }}>
          {authenticating
            ? <ActivityIndicator color="#06140C" />
            : <ThemedText style={{ fontWeight: '800', fontSize: 16, color: '#06140C' }}>Unlock</ThemedText>}
        </Pressable>
      </SafeAreaView>
    </View>
  );
}
