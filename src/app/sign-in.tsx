import { useAuth, useSignIn } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { AuthButton, AuthError, AuthField, AuthLinkRow, AuthShell } from '@/components/auth/auth-ui';
import {
  describeAuthError,
  describeUnhandledStatus,
  hasClerkErrorCode,
  normalizeEmail,
} from '@/lib/auth-errors';

export default function SignInScreen(): React.ReactElement {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = useCallback(async () => {
    if (!isLoaded || loading) return;

    // A session restored from SecureStore makes signIn.create() throw
    // `session_exists`; the user is already authenticated, so just go in.
    if (isSignedIn) {
      router.replace('/');
      return;
    }

    const identifier = normalizeEmail(email);
    if (!identifier || !password) {
      setError('Enter your email and password.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await signIn.create({ identifier, password });

      if (result.status === 'complete' && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        router.replace('/');
        return;
      }

      // Clerk requires a new password before it will issue a session — hand the
      // user to the reset flow, which is the only place that can set one.
      if (result.status === 'needs_new_password') {
        router.push({ pathname: '/forgot-password', params: { email: identifier } });
        return;
      }

      // Anything else is a flow this screen doesn't implement. Say so rather
      // than silently dropping the tap.
      setError(describeUnhandledStatus(result.status));
    } catch (e: unknown) {
      if (hasClerkErrorCode(e, 'session_exists')) {
        router.replace('/');
        return;
      }
      setError(describeAuthError(e, 'Sign in failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [isLoaded, loading, isSignedIn, email, password, signIn, setActive, router]);

  const disabled = !isLoaded || !email.trim() || !password;

  return (
    <AuthShell subtitle="Sign in to your account">
      <View className="gap-3">
        <AuthField
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <AuthField
          ref={passwordRef}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={handleSignIn}
        />

        <AuthLinkRow action="Forgot password?" onPress={() => router.push('/forgot-password')} />

        <AuthError message={error} />

        <AuthButton label="Sign In" onPress={handleSignIn} disabled={disabled} loading={loading} />
      </View>

      <AuthLinkRow
        prompt="Don't have an account?"
        action="Sign up"
        onPress={() => router.push('/sign-up')}
      />
    </AuthShell>
  );
}
