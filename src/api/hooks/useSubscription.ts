import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getSubscribed, setSubscribed } from '@/api/client/storage';

function subscriptionQueryKey() {
  return ['SUBSCRIPTION'] as const;
}

export function useSubscription() {
  const queryClient = useQueryClient();

  const { data: isSubscribed, status } = useQuery({
    queryKey: subscriptionQueryKey(),
    queryFn: getSubscribed,
  });

  const { mutate: subscribe, isPending: isSubscribing } = useMutation({
    mutationFn: () => setSubscribed(true),
    onSettled: () => queryClient.invalidateQueries({ queryKey: subscriptionQueryKey() }),
  });

  return {
    isSubscribed: isSubscribed ?? false,
    isLoading: status === 'pending',
    subscribe,
    isSubscribing,
  };
}
