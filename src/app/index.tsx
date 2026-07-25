import { useAuth } from '@clerk/clerk-expo';
import { Href, Redirect } from 'expo-router';

import { useOnboarding } from '@/api/hooks/useOnboarding';
import { useSavingsGoal } from '@/api/hooks/useSavingsGoal';
import { BrandLoader } from '@/components/ui/loaders';

export default function Index(): React.ReactElement {
  const { isLoaded, isSignedIn } = useAuth();
  const { hasCompletedOnboarding, isLoading: onboardingLoading } = useOnboarding();
  const { hasGoal, isLoading: goalLoading } = useSavingsGoal();

  if (onboardingLoading) {
    return <BrandLoader subtitle="Loading…" />;
  }

  // DEV: set EXPO_PUBLIC_DEV_FORCE_ONBOARDING=1 in .env to always see onboarding again.
  const forceOnboarding = process.env.EXPO_PUBLIC_DEV_FORCE_ONBOARDING === '1';
  if (forceOnboarding || !hasCompletedOnboarding) {
    return <Redirect href={'/onboarding' as Href} />;
  }

  if (!isLoaded) {
    return <BrandLoader subtitle="Loading your edge…" />;
  }

  // Signed-in users land on Home. Route generation runs only for subscribers;
  // route generation is open to everyone (no paywall).
  // DEV: set EXPO_PUBLIC_DEV_BYPASS_AUTH=1 in .env to skip sign-in while testing.
  const bypassAuth = process.env.EXPO_PUBLIC_DEV_BYPASS_AUTH === '1';
  if (!isSignedIn && !bypassAuth) return <Redirect href="/sign-in" />;

  // First real step after sign-in: what are you saving for? (one-time until a goal exists)
  if (goalLoading) return <BrandLoader subtitle="Loading your goal…" />;
  if (!hasGoal) return <Redirect href={'/goal-setup' as Href} />;

  return <Redirect href="/(tabs)" />;
}
