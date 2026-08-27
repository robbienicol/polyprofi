import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getEarlyAccessGranted, setEarlyAccessGranted } from '@/api/client/storage';

function earlyAccessQueryKey() {
  return ['EARLY_ACCESS_GRANTED'] as const;
}

export function useEarlyAccess() {
  const queryClient = useQueryClient();

  const { data: hasEarlyAccess, status } = useQuery({
    queryKey: earlyAccessQueryKey(),
    queryFn: getEarlyAccessGranted,
  });

  const { mutate: grantEarlyAccess, isPending: isGranting } = useMutation({
    mutationFn: setEarlyAccessGranted,
    onSettled: () => queryClient.invalidateQueries({ queryKey: earlyAccessQueryKey() }),
  });

  return {
    hasEarlyAccess: hasEarlyAccess ?? false,
    isLoading: status === 'pending',
    grantEarlyAccess,
    isGranting,
  };
}
