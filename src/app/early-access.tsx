import { useAuth } from '@clerk/clerk-expo';
import { useRouter, type Href } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';

import { useEarlyAccess } from '@/api/hooks/useEarlyAccess';
import { AuthButton, AuthError, AuthScreen, AuthTextButton } from '@/components/auth/AuthScreen';
import { AuthTextInput } from '@/components/auth/AuthTextInput';
import { ThemedText } from '@/components/themed-text';
import { isValidEarlyAccessCode } from '@/lib/early-access';

/**
 * Invite wall. Sits between sign-in and the rest of the app during early access:
 * an account is not enough on its own, the code is what opens the door.
 */
export default function EarlyAccessScreen(): React.ReactElement {
  const router = useRouter();
  const { signOut } = useAuth();
  const { grantEarlyAccess, isGranting } = useEarlyAccess();

  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = useCallback(() => {
    if (isGranting) return;
    if (!isValidEarlyAccessCode(code)) {
      setError('That code isn’t right. Check it and try again.');
      return;
    }
    setError('');
    grantEarlyAccess(undefined, {
      onSuccess: () => router.replace('/' as Href),
    });
  }, [code, grantEarlyAccess, isGranting, router]);

  return (
    <AuthScreen
      title="Early access"
      subtitle="Pathey is invite-only for now. Enter your code to get in.">
      <View className="gap-4">
        <AuthTextInput
          label="Access code"
          value={code}
          onChangeText={(next) => {
            setCode(next);
            if (error) setError('');
          }}
          placeholder="your code"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
        />

        <AuthError message={error} />

        <AuthButton
          label="Continue"
          onPress={handleSubmit}
          disabled={!code.trim()}
          loading={isGranting}
        />

        <ThemedText
          type="small"
          themeColor="textSecondary"
          className="text-center"
          style={{ opacity: 0.6 }}>
          You only need to do this once on this device.
        </ThemedText>

        <AuthTextButton label="Sign out" onPress={() => void signOut()} />
      </View>
    </AuthScreen>
  );
}
