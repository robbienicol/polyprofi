import { useSignIn } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function SignInScreen(): React.ReactElement {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const theme = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = useCallback(async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError('');
    try {
      const result = await signIn.create({ identifier: email, password });
      const status = result.status as string;
      if (status === 'complete' || status === 'needs_client_trust') {
        await setActive({ session: result.createdSessionId });
        router.replace('/');
      }
    } catch (e: unknown) {
      const clerkError = e as { errors?: { longMessage?: string; message?: string }[] };
      const msg = clerkError.errors?.[0]?.longMessage
        ?? clerkError.errors?.[0]?.message
        ?? (e instanceof Error ? e.message : null)
        ?? 'Sign in failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, signIn, email, password, setActive, router]);

  const disabled = loading || !email || !password;

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.select({ ios: 'padding', android: undefined })}
          className="flex-1 justify-center px-6 gap-10">

          <View className="items-center gap-3">
            <View style={{ width: 64, height: 64, borderRadius: Radius.xl, backgroundColor: Brand[500], alignItems: 'center', justifyContent: 'center', ...Shadow.float }}>
              <ThemedText style={{ fontSize: 34, fontWeight: '900', color: '#06140C' }}>$</ThemedText>
            </View>
            <ThemedText style={{ fontSize: 32, fontWeight: '800', letterSpacing: -0.8, color: theme.text }}>PolyProfit</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Sign in to your account</ThemedText>
          </View>

          <View className="gap-3">
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={theme.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              className="px-4 text-base border"
              style={{
                borderRadius: Radius.lg,
                color: theme.text,
                borderColor: theme.border,
                backgroundColor: theme.backgroundElement,
                paddingVertical: 16,
              }}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              autoComplete="current-password"
              className="px-4 text-base border"
              style={{
                borderRadius: Radius.lg,
                color: theme.text,
                borderColor: theme.border,
                backgroundColor: theme.backgroundElement,
                paddingVertical: 16,
              }}
            />

            <Link href="/forgot-password" asChild>
              <Pressable className="self-end active:opacity-60">
                <ThemedText type="small" style={{ color: Brand[500], fontWeight: '700' }}>
                  Forgot password?
                </ThemedText>
              </Pressable>
            </Link>

            {!!error && (
              <ThemedText type="small" className="text-center" style={{ color: '#ef4444' }}>
                {error}
              </ThemedText>
            )}

            <Pressable
              onPress={handleSignIn}
              disabled={disabled}
              className="py-4 items-center mt-1 active:opacity-80"
              style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], opacity: disabled ? 0.45 : 1, ...Shadow.card }}>
              {loading
                ? <ActivityIndicator color="#06140C" />
                : <ThemedText style={{ fontWeight: '800', fontSize: 16, color: '#06140C' }}>Sign In</ThemedText>}
            </Pressable>
          </View>

          <Link href="/sign-up" asChild>
            <Pressable className="items-center active:opacity-60">
              <ThemedText type="small" themeColor="textSecondary">
                Don&apos;t have an account?{' '}
                <ThemedText type="small" style={{ color: Brand[500], fontWeight: '700' }}>Sign up</ThemedText>
              </ThemedText>
            </Pressable>
          </Link>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
