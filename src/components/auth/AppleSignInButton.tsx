import { useSignInWithApple } from '@clerk/clerk-expo';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useScheme, useTheme } from '@/hooks/use-theme';
import { clerkErrorMessage } from '@/lib/clerk-errors';

/**
 * Native Sign in with Apple, for sign-in and sign-up alike: Clerk works out whether
 * the Apple ID already has an account and transfers between the two itself. Apple
 * verifies the email, so these accounts skip the email code step.
 *
 * iOS only. Nothing renders elsewhere — web and Android keep email and password.
 */
export function AppleSignInButton({ onError }: { onError: (message: string) => void }): React.ReactElement | null {
  const { startAppleAuthenticationFlow } = useSignInWithApple();
  const router = useRouter();
  const theme = useTheme();
  const scheme = useScheme();
  const [busy, setBusy] = useState(false);

  if (Platform.OS !== 'ios') return null;

  const handlePress = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    onError('');
    try {
      const { createdSessionId, setActive } = await startAppleAuthenticationFlow();
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace('/');
      }
    } catch (e: unknown) {
      // Closing the Apple sheet is a choice, not a failure.
      if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return;
      onError(clerkErrorMessage(e, 'Apple sign-in failed. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 14 }}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={
          scheme === 'dark'
            ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
        }
        cornerRadius={Radius.lg}
        style={{ height: 54, opacity: busy ? 0.5 : 1 }}
        onPress={() => void handlePress()}
      />
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
        <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.textTertiary }}>or use email</ThemedText>
        <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
      </View>
    </View>
  );
}
