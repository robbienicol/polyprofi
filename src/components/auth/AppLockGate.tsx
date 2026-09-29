import { useAuth } from '@clerk/clerk-expo';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authenticateWithBiometrics, useBiometricLock } from '@/api/hooks/useBiometricLock';
import { BrandMark } from '@/components/ui/BrandMark';
import { ThemedText } from '@/components/themed-text';
import { Brand, OnBrand, Radius, Shadow } from '@/constants/theme';
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

  // The app stays mounted underneath the lock and the lock covers it, rather than
  // replacing it. Swapping the children out unmounted the whole navigator, so an
  // unlock after the grace period started over from the first screen and threw away
  // a half-filled quiz or form, and a deep link that landed during a cold-start check
  // was dropped. While the lock setting is still loading for a signed-in user, the
  // cover is drawn blank so no content flashes before the lock can appear.
  const locked = shouldLock && !unlocked;
  const pending = isLoading && isSignedIn;
  const covered = locked || pending;

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{ flex: 1 }}
        accessibilityElementsHidden={covered}
        importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}>
        {children}
      </View>
      {covered ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.background }]}>
          {locked ? <LockScreen authenticating={authenticating} onUnlock={attemptUnlock} /> : null}
        </View>
      ) : null}
    </View>
  );
}

function LockScreen({
  authenticating,
  onUnlock,
}: {
  authenticating: boolean;
  onUnlock: () => void;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <SafeAreaView className="flex-1 items-center justify-center gap-8 px-8">
        <BrandMark size={72} style={{ ...Shadow.float }} />

        <View className="items-center gap-2">
          <ThemedText style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>Pathey is locked</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Unlock with Face ID to continue</ThemedText>
        </View>

        <Pressable
          onPress={onUnlock}
          disabled={authenticating}
          className="py-4 px-8 items-center active:opacity-80"
          style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], opacity: authenticating ? 0.6 : 1, ...Shadow.card }}>
          {authenticating
            ? <ActivityIndicator color={OnBrand} />
            : <ThemedText style={{ fontWeight: '800', fontSize: 16, color: OnBrand }}>Unlock</ThemedText>}
        </Pressable>
      </SafeAreaView>
    </View>
  );
}
