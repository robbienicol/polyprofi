import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getOnboardingComplete, setOnboardingComplete } from '@/api/client/storage';
import { deviceQuery } from '@/api/query-client';

function onboardingQueryKey() {
  return ['ONBOARDING_COMPLETE'] as const;
}

export function useOnboarding() {
  const queryClient = useQueryClient();

  const { data: hasCompletedOnboarding, status } = useQuery({
    queryKey: onboardingQueryKey(),
    queryFn: getOnboardingComplete,
    ...deviceQuery,
  });

  // Flipped in the cache before the disk write resolves: the carousel's last
  // button navigates straight to the next screen, and `app/index.tsx` re-reads
  // this flag as it lands. Waiting on AsyncStorage there bounced the user back
  // into onboarding for a frame.
  const { mutate: completeOnboarding, isPending: isCompleting } = useMutation({
    mutationFn: setOnboardingComplete,
    onMutate: () => {
      const previous = queryClient.getQueryData<boolean>(onboardingQueryKey());
      queryClient.setQueryData(onboardingQueryKey(), true);
      return { previous };
    },
    onError: (_error, _input, context) => {
      queryClient.setQueryData(onboardingQueryKey(), context?.previous ?? false);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: onboardingQueryKey() }),
  });

  return {
    hasCompletedOnboarding: hasCompletedOnboarding ?? false,
    isLoading: status === 'pending',
    completeOnboarding,
    isCompleting,
  };
}
