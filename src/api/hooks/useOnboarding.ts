import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getOnboardingComplete, setOnboardingComplete } from '@/api/client/storage';

function onboardingQueryKey() {
  return ['ONBOARDING_COMPLETE'] as const;
}

export function useOnboarding() {
  const queryClient = useQueryClient();

  const { data: hasCompletedOnboarding, status } = useQuery({
    queryKey: onboardingQueryKey(),
    queryFn: getOnboardingComplete,
  });

  const { mutate: completeOnboarding, isPending: isCompleting } = useMutation({
    mutationFn: setOnboardingComplete,
    onSettled: () => queryClient.invalidateQueries({ queryKey: onboardingQueryKey() }),
  });

  return {
    hasCompletedOnboarding: hasCompletedOnboarding ?? false,
    isLoading: status === 'pending',
    completeOnboarding,
    isCompleting,
  };
}
