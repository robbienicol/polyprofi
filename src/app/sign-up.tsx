import { useSignUp } from '@clerk/clerk-expo';
import { useRouter, type Href } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import {
  AuthButton,
  AuthError,
  AuthFooterLink,
  AuthScreen,
  AuthTextButton,
} from '@/components/auth/AuthScreen';
import { AuthTextInput } from '@/components/auth/AuthTextInput';
import { ThemedText } from '@/components/themed-text';
import { clerkErrorMessage } from '@/lib/clerk-errors';

export default function SignUpScreen(): React.ReactElement {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignUp = useCallback(async () => {
    if (!isLoaded || loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await signUp.create({
        emailAddress: email.trim().toLowerCase(),
        password,
      });

      // When the Clerk instance doesn't require email verification, sign-up is
      // already done here. The old code always jumped to the code step, so a
      // user with no code to enter was stuck on a dead-end screen.
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/');
        return;
      }

      if (result.unverifiedFields?.includes('email_address')) {
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setStep('verify');
        return;
      }

      setError('We couldn’t finish creating your account. Please try again.');
    } catch (e: unknown) {
      setError(clerkErrorMessage(e, 'Sign up failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [isLoaded, loading, signUp, email, password, setActive, router]);

  const handleVerify = useCallback(async () => {
    if (!isLoaded || loading) return;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/');
      } else {
        // Previously this branch did nothing, so the button looked broken.
        setError('That code isn’t right. Check it or send a new one.');
      }
    } catch (e: unknown) {
      setError(clerkErrorMessage(e, 'Verification failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [isLoaded, loading, signUp, code, setActive, router]);

  const handleResend = useCallback(async () => {
    if (!isLoaded || loading) return;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setNotice('New code sent. It can take a minute to arrive.');
    } catch (e: unknown) {
      setError(clerkErrorMessage(e, 'Couldn’t send a new code. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [isLoaded, loading, signUp]);

  if (step === 'verify') {
    return (
      <AuthScreen title="Check your email" subtitle={`We sent a 6-digit code to ${email.trim()}`}>
        <View className="gap-4">
          <AuthTextInput
            value={code}
            onChangeText={setCode}
            placeholder="000000"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            autoFocus
            maxLength={6}
            returnKeyType="go"
            onSubmitEditing={handleVerify}
            style={{
              fontSize: 30,
              letterSpacing: 12,
              fontWeight: '800',
              textAlign: 'center',
              fontVariant: ['tabular-nums'],
            }}
          />
          <AuthError message={error} />
          {!!notice && (
            <ThemedText type="small" themeColor="textSecondary" className="text-center">
              {notice}
            </ThemedText>
          )}
          <AuthButton
            label="Verify Email"
            onPress={handleVerify}
            disabled={code.trim().length < 6}
            loading={loading}
          />
          <AuthTextButton label="Send a new code" onPress={handleResend} disabled={loading} />
          <AuthTextButton
            label="Use a different email"
            onPress={() => {
              setStep('form');
              setCode('');
              setError('');
              setNotice('');
            }}
          />
        </View>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="PolyProfit"
      subtitle="Create your account"
      footer={
        <View className="gap-6">
          <AuthFooterLink prompt="Already have an account?" action="Sign in" href="/sign-in" />
          <ThemedText
            type="small"
            themeColor="textSecondary"
            className="text-center"
            style={{ opacity: 0.6 }}>
            By creating an account you agree to our{' '}
            <ThemedText
              type="small"
              style={{ opacity: 1, textDecorationLine: 'underline' }}
              onPress={() => router.push('/terms' as Href)}>
              Terms
            </ThemedText>{' '}
            and{' '}
            <ThemedText
              type="small"
              style={{ opacity: 1, textDecorationLine: 'underline' }}
              onPress={() => router.push('/privacy' as Href)}>
              Privacy Policy
            </ThemedText>
            .
          </ThemedText>
        </View>
      }>
      <View className="gap-4">
        <AuthTextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <AuthTextInput
          ref={passwordRef}
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={handleSignUp}
        />
        <AuthError message={error} />
        <AuthButton
          label="Create Account"
          onPress={handleSignUp}
          disabled={!email.trim() || password.length < 8}
          loading={loading}
        />
      </View>
    </AuthScreen>
  );
}
