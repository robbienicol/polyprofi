import { useSignUp } from '@clerk/clerk-expo';
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

export default function SignUpScreen(): React.ReactElement {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const theme = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignUp = useCallback(async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError('');
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setStep('verify');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isLoaded, signUp, email, password]);

  const handleVerify = useCallback(async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError('');
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isLoaded, signUp, code, setActive, router]);

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
            <ThemedText type="small" themeColor="textSecondary">
              {step === 'form' ? 'Create your account' : 'Check your email'}
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
              <AuthTextInput
                label="Password"
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
                onPress={handleSignUp}
                disabled={loading || !email || !password}
                className="py-4 items-center mt-1 active:opacity-80"
                style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], opacity: loading || !email || !password ? 0.45 : 1, ...Shadow.card }}>
                {loading
                  ? <ActivityIndicator color="#06140C" />
                  : <ThemedText style={{ fontWeight: '800', fontSize: 16, color: '#06140C' }}>Create Account</ThemedText>}
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
              {!!error && (
                <ThemedText type="small" className="text-center" style={{ color: '#ef4444' }}>{error}</ThemedText>
              )}
              <Pressable
                onPress={handleVerify}
                disabled={loading || code.length < 6}
                className="py-4 items-center mt-1 active:opacity-80"
                style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], opacity: loading || code.length < 6 ? 0.45 : 1, ...Shadow.card }}>
                {loading
                  ? <ActivityIndicator color="#06140C" />
                  : <ThemedText style={{ fontWeight: '800', fontSize: 16, color: '#06140C' }}>Verify Email</ThemedText>}
              </Pressable>
            </View>
          )}

          <Link href="/sign-in" asChild>
            <Pressable className="items-center active:opacity-60">
              <ThemedText type="small" themeColor="textSecondary">
                Already have an account?{' '}
                <ThemedText type="small" style={{ color: Brand[500], fontWeight: '700' }}>Sign in</ThemedText>
              </ThemedText>
            </Pressable>
          </Link>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
