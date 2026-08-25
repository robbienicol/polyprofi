import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getOnboardingProfile, updateOnboardingProfile } from '@/api/client/storage';
import { DEFAULT_ONBOARDING_PROFILE, firstName, type OnboardingProfile } from '@/lib/onboarding-profile';

function onboardingProfileKey() {
  return ['ONBOARDING_PROFILE'] as const;
}

/**
 * The local half of the first-run answers — name, consent, and the questions the
 * server profile has no column for. Writes land in the cache before the disk
 * write resolves, because the very next screen usually reads the name back.
 */
export function useOnboardingProfile() {
  const queryClient = useQueryClient();

  const { data, status } = useQuery({
    queryKey: onboardingProfileKey(),
    queryFn: getOnboardingProfile,
  });

  const { mutate: patchProfile, mutateAsync: patchProfileAsync } = useMutation({
    mutationFn: (patch: Partial<OnboardingProfile>) => updateOnboardingProfile(patch),
    onSuccess: (next) => queryClient.setQueryData(onboardingProfileKey(), next),
  });

  const profile = data ?? DEFAULT_ONBOARDING_PROFILE;

  return {
    profile,
    name: firstName(profile),
    isLoading: status === 'pending',
    patchProfile,
    patchProfileAsync,
  };
}
