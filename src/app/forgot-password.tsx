import { useAuth, useSignIn } from '@clerk/clerk-expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';

import { AuthButton, AuthError, AuthField, AuthLinkRow, AuthShell } from '@/components/auth/auth-ui';
import { ThemedText } from '@/components/themed-text';
import {
  describeAuthError,
  describeUnhandledStatus,
  hasClerkErrorCode,
  normalizeEmail,
} from '@/lib/auth-errors';

/** Clerk's minimum is configurable per instance; 8 is its default floor. */
const MIN_PASSWORD_LENGTH = 8;

export default function ForgotPasswordScreen(): React.ReactElement {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { isSignedIn, signOut } = useAuth();
  const router = useRouter();

  // Sign-in passes the address along so the user doesn't retype it.
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  /** Ask Clerk to email a reset code. */
  const handleRequestCode = useCallback(async () => {
    if (!isLoaded || loading) return;

    const identifier = normalizeEmail(email);
    if (!identifier) {
      setError('Enter the email address for your account.');
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');
    try {
      // A lingering session makes signIn.create() throw `session_exists`, which
      // would lock a signed-in user out of resetting their own password.
      if (isSignedIn) await signOut();

      await signIn.create({ strategy: 'reset_password_email_code', identifier });
      setStep('reset');
      setNotice(`We sent a 6-digit code to ${identifier}.`);
    } catch (e: unknown) {
      setError(describeAuthError(e, 'Could not send a reset code. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [isLoaded, loading, email, isSignedIn, signOut, signIn]);

  /** Submit the code and the new password together — Clerk does both at once. */
  const handleResetPassword = useCallback(async () => {
    if (!isLoaded || loading) return;

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: code.trim(),
        password,
      });

      if (result.status === 'complete' && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        router.replace('/');
        return;
      }

      setError(describeUnhandledStatus(result.status));
    } catch (e: unknown) {
      // An expired or exhausted code needs a fresh one, so send the user back.
      if (hasClerkErrorCode(e, 'verification_expired', 'verification_failed')) {
        setStep('request');
        setCode('');
      }
      setError(describeAuthError(e, 'Could not reset your password. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [isLoaded, loading, password, signIn, code, setActive, router]);

  const isRequestStep = step === 'request';

  return (
    <AuthShell subtitle={isRequestStep ? 'Reset your password' : 'Choose a new password'}>
      {isRequestStep ? (
        <View className="gap-3">
          <ThemedText type="small" themeColor="textSecondary" className="text-center">
            Enter your email and we&apos;ll send you a code to set a new password.
          </ThemedText>
          <AuthField
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="go"
            onSubmitEditing={handleRequestCode}
          />
          <AuthError message={error} />
          <AuthButton
            label="Send Reset Code"
            onPress={handleRequestCode}
            disabled={!isLoaded || !email.trim()}
            loading={loading}
          />
        </View>
      ) : (
        <View className="gap-3">
          {!!notice && (
            <ThemedText type="small" themeColor="textSecondary" className="text-center">
              {notice}
            </ThemedText>
          )}
          <AuthField
            value={code}
            onChangeText={setCode}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            className="px-4 border text-center"
            style={{
              fontSize: 28,
              letterSpacing: 10,
              fontWeight: '700',
              fontVariant: ['tabular-nums'],
            }}
          />
          <AuthField
            value={password}
            onChangeText={setPassword}
            placeholder="New password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={handleResetPassword}
          />
          <AuthError message={error} />
          <AuthButton
            label="Set New Password"
            onPress={handleResetPassword}
            disabled={code.trim().length < 6 || !password}
            loading={loading}
          />
          <AuthLinkRow
            action="Use a different email"
            onPress={() => {
              setStep('request');
              setCode('');
              setPassword('');
              setError('');
              setNotice('');
            }}
          />
        </View>
      )}

      <AuthLinkRow prompt="Remembered it?" action="Back to sign in" onPress={() => router.replace('/sign-in')} />
    </AuthShell>
  );
}
