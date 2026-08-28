import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { clearDevReplayFunnel, getDevReplayFunnel } from '@/api/client/storage';
import { deviceQuery } from '@/api/query-client';

function replayKey() {
  return ['DEV_REPLAY_FUNNEL'] as const;
}

/**
 * Whether the dev "Replay onboarding" button is mid-run.
 *
 * While it is, the router walks the first-run funnel again even though the
 * server still has this user's profile marked complete. `finishReplay` is called
 * by the build screen once the quiz has been answered a second time, which is
 * what puts the app back on its normal route.
 */
export function useDevReplayFunnel() {
  const queryClient = useQueryClient();

  const { data, status } = useQuery({
    queryKey: replayKey(),
    queryFn: getDevReplayFunnel,
    // Never true outside a dev build — the flag can only be set from one.
    enabled: __DEV__,
    ...deviceQuery,
  });

  const { mutate: finishReplay } = useMutation({
    mutationFn: clearDevReplayFunnel,
    onMutate: () => {
      queryClient.setQueryData(replayKey(), false);
    },
  });

  return {
    replaying: __DEV__ && (data ?? false),
    isLoading: __DEV__ && status === 'pending',
    finishReplay,
  };
}
