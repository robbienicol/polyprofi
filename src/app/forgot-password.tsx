import { useSignIn } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';

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

export default function ForgotPasswordScreen(): React.ReactElement {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'form' | 'reset'>('form');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sendCode = useCallback(
    async (isResend: boolean) => {
      if (!isLoaded || loading) return;
      setLoading(true);
      setError('');
      setNotice('');
      try {
        await signIn.create({
          strategy: 'reset_password_email_code',
          identifier: email.trim().toLowerCase(),
        });
        setStep('reset');
        if (isResend) setNotice('New code sent. It can take a minute to arrive.');
      } catch (e: unknown) {
        setError(clerkErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [isLoaded, loading, signIn, email],
  );

  const handleReset = useCallback(async () => {
    if (!isLoaded || loading) return;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: code.trim(),
        password,
      });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/');
      } else if (result.status === 'needs_second_factor') {
        // The password is changed at this point; finish the second factor on sign-in.
        setError('Password updated. Sign in again to finish your verification step.');
      } else {
        setError('Invalid or expired code. Send a new one and try again.');
      }
    } catch (e: unknown) {
      setError(clerkErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [isLoaded, loading, signIn, code, password, setActive, router]);

  return (
    <AuthScreen
      title="Reset password"
      subtitle={
        step === 'form'
          ? 'Enter your email and we’ll send you a code'
          : `We sent a 6-digit code to ${email.trim()}`
      }
      footer={<AuthFooterLink prompt="Remembered it?" action="Sign in" href="/sign-in" />}>
      {step === 'form' ? (
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
            autoFocus
            returnKeyType="go"
            onSubmitEditing={() => sendCode(false)}
          />
          <AuthError message={error} />
          <AuthButton
            label="Send Code"
            onPress={() => sendCode(false)}
            disabled={!email.trim()}
            loading={loading}
          />
        </View>
      ) : (
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
            style={{
              fontSize: 30,
              letterSpacing: 12,
              fontWeight: '800',
              textAlign: 'center',
              fontVariant: ['tabular-nums'],
            }}
          />
          <AuthTextInput
            label="New password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={handleReset}
          />
          <AuthError message={error} />
          {!!notice && (
            <ThemedText type="small" themeColor="textSecondary" className="text-center">
              {notice}
            </ThemedText>
          )}
          <AuthButton
            label="Reset Password"
            onPress={handleReset}
            disabled={code.trim().length < 6 || password.length < 8}
            loading={loading}
          />
          <AuthTextButton label="Send a new code" onPress={() => sendCode(true)} disabled={loading} />
        </View>
      )}
    </AuthScreen>
  );
}
