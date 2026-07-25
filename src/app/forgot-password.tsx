import { useSignIn } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthTextInput } from '@/components/auth/AuthTextInput';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function ForgotPasswordScreen(): React.ReactElement {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const theme = useTheme();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'form' | 'reset'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const parseError = (e: unknown): string => {
    const clerkError = e as { errors?: { longMessage?: string; message?: string }[] };
    return clerkError.errors?.[0]?.longMessage
      ?? clerkError.errors?.[0]?.message
      ?? (e instanceof Error ? e.message : null)
      ?? 'Something went wrong. Please try again.';
  };

  const handleSendCode = useCallback(async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError('');
    try {
      await signIn.create({ strategy: 'reset_password_email_code', identifier: email });
      setStep('reset');
    } catch (e: unknown) {
      setError(parseError(e));
    } finally {
      setLoading(false);
    }
  }, [isLoaded, signIn, email]);

  const handleReset = useCallback(async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError('');
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code,
        password,
      });
      const status = result.status as string;
      if (status === 'complete' || status === 'needs_client_trust') {
        await setActive({ session: result.createdSessionId });
        router.replace('/');
      }
    } catch (e: unknown) {
      setError(parseError(e));
    } finally {
      setLoading(false);
    }
  }, [isLoaded, signIn, code, password, setActive, router]);

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
            <ThemedText style={{ fontSize: 32, fontWeight: '800', letterSpacing: -0.8, color: theme.text }}>Reset password</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {step === 'form' ? 'Enter your email to get a code' : 'Check your email'}
            </ThemedText>
          </View>

          {step === 'form' ? (
            <View className="gap-4">
              <AuthTextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              {!!error && (
                <ThemedText type="small" className="text-center" style={{ color: '#ef4444' }}>{error}</ThemedText>
              )}
              <Pressable
                onPress={handleSendCode}
                disabled={loading || !email}
                className="py-4 items-center mt-1 active:opacity-80"
                style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], opacity: loading || !email ? 0.45 : 1, ...Shadow.card }}>
                {loading
                  ? <ActivityIndicator color="#06140C" />
                  : <ThemedText style={{ fontWeight: '800', fontSize: 16, color: '#06140C' }}>Send Code</ThemedText>}
              </Pressable>
            </View>
          ) : (
            <View className="gap-4">
              <ThemedText type="small" themeColor="textSecondary" className="text-center">
                We sent a 6-digit code to {email}
              </ThemedText>
              <AuthTextInput
                value={code}
                onChangeText={setCode}
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                style={{ fontSize: 30, letterSpacing: 12, fontWeight: '800', textAlign: 'center', fontVariant: ['tabular-nums'] }}
              />
              <AuthTextInput
                label="New password"
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                secureTextEntry
                autoComplete="new-password"
              />
              {!!error && (
                <ThemedText type="small" className="text-center" style={{ color: '#ef4444' }}>{error}</ThemedText>
              )}
              <Pressable
                onPress={handleReset}
                disabled={loading || code.length < 6 || !password}
                className="py-4 items-center mt-1 active:opacity-80"
                style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], opacity: loading || code.length < 6 || !password ? 0.45 : 1, ...Shadow.card }}>
                {loading
                  ? <ActivityIndicator color="#06140C" />
                  : <ThemedText style={{ fontWeight: '800', fontSize: 16, color: '#06140C' }}>Reset Password</ThemedText>}
              </Pressable>
            </View>
          )}

          <Link href="/sign-in" asChild>
            <Pressable className="items-center active:opacity-60">
              <ThemedText type="small" themeColor="textSecondary">
                Remembered it?{' '}
                <ThemedText type="small" style={{ color: Brand[500], fontWeight: '700' }}>Sign in</ThemedText>
              </ThemedText>
            </Pressable>
          </Link>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
