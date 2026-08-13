import { useSignIn } from '@clerk/clerk-expo';
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
import { useDevLogin } from '@/hooks/use-dev-login';
import { clerkErrorMessage } from '@/lib/clerk-errors';

/** Second factor we can collect in-app, in preference order. */
type SecondFactor = 'totp' | 'phone_code' | 'backup_code';

const SECOND_FACTOR_COPY: Record<SecondFactor, string> = {
  totp: 'Enter the 6-digit code from your authenticator app.',
  phone_code: 'We texted you a 6-digit code.',
  backup_code: 'Enter one of your backup codes.',
};

export default function SignInScreen(): React.ReactElement {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const passwordRef = useRef<TextInput>(null);
  const { available: devAvailable, loading: devLoading, run: runDevLogin } = useDevLogin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [secondFactor, setSecondFactor] = useState<SecondFactor | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = useCallback(async () => {
    if (!isLoaded || loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await signIn.create({
        identifier: email.trim().toLowerCase(),
        password,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/');
        return;
      }

      if (result.status === 'needs_second_factor') {
        // Previously this fell into the generic "invalid email or password" branch,
        // which made a 2FA-enabled account impossible to sign into.
        const factors = result.supportedSecondFactors ?? [];
        const phone = factors.find((f) => f.strategy === 'phone_code');
        const chosen: SecondFactor | null = factors.some((f) => f.strategy === 'totp')
          ? 'totp'
          : phone
            ? 'phone_code'
            : factors.some((f) => f.strategy === 'backup_code')
              ? 'backup_code'
              : null;

        if (!chosen) {
          setError('This account needs a verification step the app can’t complete. Contact support.');
          return;
        }
        if (chosen === 'phone_code' && phone?.phoneNumberId) {
          await signIn.prepareSecondFactor({
            strategy: 'phone_code',
            phoneNumberId: phone.phoneNumberId,
          });
        }
        setSecondFactor(chosen);
        return;
      }

      if (result.status === 'needs_new_password') {
        router.push('/forgot-password' as Href);
        return;
      }

      // Bot/enumeration protection reports a wrong email or password as
      // 'needs_first_factor' rather than throwing.
      setError('That email and password don’t match an account.');
    } catch (e: unknown) {
      setError(clerkErrorMessage(e, 'Sign in failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [isLoaded, loading, signIn, email, password, setActive, router]);

  const handleDevLogin = useCallback(async () => {
    setError('');
    const message = await runDevLogin();
    if (message) setError(message);
  }, [runDevLogin]);

  const handleSecondFactor = useCallback(async () => {
    if (!isLoaded || !secondFactor || loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await signIn.attemptSecondFactor({ strategy: secondFactor, code: code.trim() });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/');
      } else {
        setError('That code isn’t right. Try again.');
      }
    } catch (e: unknown) {
      setError(clerkErrorMessage(e, 'Verification failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [isLoaded, secondFactor, loading, signIn, code, setActive, router]);

  if (secondFactor) {
    return (
      <AuthScreen title="One more step" subtitle={SECOND_FACTOR_COPY[secondFactor]}>
        <View className="gap-4">
          <AuthTextInput
            value={code}
            onChangeText={setCode}
            placeholder={secondFactor === 'backup_code' ? 'backup code' : '000000'}
            keyboardType={secondFactor === 'backup_code' ? 'default' : 'number-pad'}
            autoCapitalize="none"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            autoFocus
            maxLength={secondFactor === 'backup_code' ? 32 : 6}
            returnKeyType="go"
            onSubmitEditing={handleSecondFactor}
            style={{
              fontSize: secondFactor === 'backup_code' ? 20 : 30,
              letterSpacing: secondFactor === 'backup_code' ? 2 : 12,
              fontWeight: '800',
              textAlign: 'center',
              fontVariant: ['tabular-nums'],
            }}
          />
          <AuthError message={error} />
          <AuthButton
            label="Continue"
            onPress={handleSecondFactor}
            disabled={code.trim().length < 6}
            loading={loading}
          />
          <AuthTextButton
            label="Use a different account"
            onPress={() => {
              setSecondFactor(null);
              setCode('');
              setError('');
            }}
          />
        </View>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Pathey"
      subtitle="Sign in to your account"
      footer={<AuthFooterLink prompt="Don’t have an account?" action="Sign up" href="/sign-up" />}>
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
          placeholder="Your password"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={handleSignIn}
        />

        <AuthTextButton
          label="Forgot password?"
          align="end"
          onPress={() => router.push('/forgot-password' as Href)}
        />

        <AuthError message={error} />

        <AuthButton
          label="Sign In"
          onPress={handleSignIn}
          disabled={!email.trim() || !password}
          loading={loading}
        />

        <ThemedText
          type="small"
          themeColor="textSecondary"
          className="text-center"
          style={{ opacity: 0.6 }}>
          We keep you signed in — you won’t have to do this again on this device.
        </ThemedText>

        {devAvailable && (
          <View className="gap-1 mt-2">
            <AuthTextButton
              label={devLoading ? 'Signing in…' : '⚡ Dev sign-in'}
              onPress={handleDevLogin}
              disabled={devLoading || loading}
            />
            <ThemedText
              type="small"
              themeColor="textSecondary"
              className="text-center"
              style={{ opacity: 0.45 }}>
              Local dev only — stripped from release builds
            </ThemedText>
          </View>
        )}
      </View>
    </AuthScreen>
  );
}
