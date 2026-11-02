import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getEarlyAccessGranted, setEarlyAccessGranted } from '@/api/client/storage';
import { deviceQuery } from '@/api/query-client';

function earlyAccessQueryKey() {
  return ['EARLY_ACCESS_GRANTED'] as const;
}

export function useEarlyAccess() {
  const queryClient = useQueryClient();

  const { data: hasEarlyAccess, status } = useQuery({
    queryKey: earlyAccessQueryKey(),
    queryFn: getEarlyAccessGranted,
    ...deviceQuery,
  });

  // The invite screen navigates the moment the code checks out, so the gate it
  // navigates into has to already see the grant.
  const { mutate: grantEarlyAccess, isPending: isGranting } = useMutation({
    mutationFn: setEarlyAccessGranted,
    onMutate: () => {
      const previous = queryClient.getQueryData<boolean>(earlyAccessQueryKey());
      queryClient.setQueryData(earlyAccessQueryKey(), true);
      return { previous };
    },
    onError: (_error, _input, context) => {
      queryClient.setQueryData(earlyAccessQueryKey(), context?.previous ?? false);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: earlyAccessQueryKey() }),
  });

  return {
    hasEarlyAccess: hasEarlyAccess ?? false,
    isLoading: status === 'pending',
    grantEarlyAccess,
    isGranting,
  };
}
