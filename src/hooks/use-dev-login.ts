import { useSignIn, useSignUp } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { clerkErrorMessage } from '@/lib/clerk-errors';
import { DEV_LOGIN } from '@/lib/dev-login';

/**
 * Signs in with the throwaway account from `DEV_LOGIN`, creating it first if it
 * doesn't exist yet — so a fresh Clerk instance or a reinstalled app is one tap
 * away from being signed in.
 *
 * `run()` resolves to an error message, or null on success (it navigates itself).
 */
export function useDevLogin(): {
  available: boolean;
  loading: boolean;
  run: () => Promise<string | null>;
} {
  const { signIn, setActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const run = useCallback(async (): Promise<string | null> => {
    if (!DEV_LOGIN) return 'Set EXPO_PUBLIC_DEV_LOGIN_EMAIL and _PASSWORD in .env first.';
    if (!signInLoaded || !signUpLoaded) return 'Auth is still loading — try again in a second.';

    setLoading(true);
    try {
      try {
        const attempt = await signIn.create({
          identifier: DEV_LOGIN.email,
          password: DEV_LOGIN.password,
        });
        if (attempt.status === 'complete') {
          await setActive({ session: attempt.createdSessionId });
          router.replace('/');
          return null;
        }
      } catch {
        // No such account (or enumeration protection hid it) — fall through and create it.
      }

      const created = await signUp.create({
        emailAddress: DEV_LOGIN.email,
        password: DEV_LOGIN.password,
      });
      if (created.status === 'complete') {
        await setActive({ session: created.createdSessionId });
        router.replace('/');
        return null;
      }
      return 'Dev account needs email verification. Turn "Verify at sign-up" off in Clerk, or use Sign up.';
    } catch (e: unknown) {
      const code = (e as { errors?: { code?: string }[] })?.errors?.[0]?.code;
      if (code === 'form_identifier_exists') {
        return 'That dev account exists, but EXPO_PUBLIC_DEV_LOGIN_PASSWORD doesn’t match it.';
      }
      return clerkErrorMessage(e, 'Dev login failed.');
    } finally {
      setLoading(false);
    }
  }, [signInLoaded, signUpLoaded, signIn, signUp, setActive, router]);

  return { available: DEV_LOGIN !== null, loading, run };
}
