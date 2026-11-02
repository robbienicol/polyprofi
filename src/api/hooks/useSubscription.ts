import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getSubscribed, setSubscribed } from '@/api/client/storage';
import { deviceQuery } from '@/api/query-client';

function subscriptionQueryKey() {
  return ['SUBSCRIPTION'] as const;
}

export function useSubscription() {
  const queryClient = useQueryClient();

  const { data: isSubscribed, status } = useQuery({
    queryKey: subscriptionQueryKey(),
    queryFn: getSubscribed,
    ...deviceQuery,
  });

  const { mutate: subscribe, isPending: isSubscribing } = useMutation({
    mutationFn: () => setSubscribed(true),
    onMutate: () => {
      const previous = queryClient.getQueryData<boolean>(subscriptionQueryKey());
      queryClient.setQueryData(subscriptionQueryKey(), true);
      return { previous };
    },
    onError: (_error, _input, context) => {
      queryClient.setQueryData(subscriptionQueryKey(), context?.previous ?? false);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: subscriptionQueryKey() }),
  });

  return {
    isSubscribed: isSubscribed ?? false,
    isLoading: status === 'pending',
    subscribe,
    isSubscribing,
  };
}
