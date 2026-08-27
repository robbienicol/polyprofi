import { useAuth } from '@clerk/clerk-expo';
import { Href, Redirect } from 'expo-router';

import { useOnboarding } from '@/api/hooks/useOnboarding';
import { useOnboardingProfile } from '@/api/hooks/useOnboardingProfile';
import { useDevReplayFunnel } from '@/api/hooks/useDevReplayFunnel';
import { useEarlyAccess } from '@/api/hooks/useEarlyAccess';
import { useSavingsGoal } from '@/api/hooks/useSavingsGoal';
import { useUserProfile } from '@/api/hooks/useUserProfile';
import { BrandLoader } from '@/components/ui/loaders';

export default function Index(): React.ReactElement {
  const { isLoaded, isSignedIn } = useAuth();
  const { hasCompletedOnboarding, isLoading: onboardingLoading } = useOnboarding();
  const { isLoading: localProfileLoading } = useOnboardingProfile();
  const { replaying, isLoading: replayLoading } = useDevReplayFunnel();
  const { hasCompletedProfile, checkFailed: profileCheckFailed, isLoading: profileLoading } = useUserProfile();
  const { hasGoal, isLoading: goalLoading } = useSavingsGoal();
  const { hasEarlyAccess, isLoading: earlyAccessLoading } = useEarlyAccess();

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
  // Gated on `__DEV__` so a release build can never skip auth, whatever the env holds.
  const bypassAuth = __DEV__ && process.env.EXPO_PUBLIC_DEV_BYPASS_AUTH === '1';
  if (!isSignedIn && !bypassAuth) return <Redirect href="/sign-in" />;

  // Invite wall. Deliberately after sign-in: an account on its own does not open
  // the app during early access, the code does. Skipped under the dev auth
  // bypass, which exists precisely to get past gates like this one.
  if (!bypassAuth) {
    if (earlyAccessLoading) return <BrandLoader subtitle="Loading…" />;
    if (!hasEarlyAccess) return <Redirect href={'/early-access' as Href} />;
  }

  // Straight into the quiz that builds their plan. The greeting is not here —
  // it is the second slide of the carousel, right after they give their name.
  //
  // Skipped when the profile check itself failed: an unreachable API is not
  // evidence the survey is outstanding, and forcing it on that made returning
  // users retake it every launch. A replay is the deliberate exception — it asks
  // for the funnel regardless of what the server thinks.
  //
  // `replaying` is the dev button on the sign-in screen: the completion flag it
  // would otherwise have to beat lives on the server, so this is what lets the
  // funnel be walked again without touching the database.
  if (!bypassAuth) {
    if (profileLoading || localProfileLoading || replayLoading) {
      return <BrandLoader subtitle="Loading your profile…" />;
    }
    if ((!hasCompletedProfile && !profileCheckFailed) || replaying) {
      return <Redirect href={'/profile-survey' as Href} />;
    }
  }

  // First real step after sign-in: what are you saving for? (one-time until a goal exists)
  if (goalLoading) return <BrandLoader subtitle="Loading your goal…" />;
  if (!hasGoal) return <Redirect href={'/goal-setup' as Href} />;

  return <Redirect href="/(tabs)" />;
}
