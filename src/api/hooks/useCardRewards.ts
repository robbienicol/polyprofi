import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';

import { apiBaseUrl } from '@/lib/api-base-url';
import type { CardRewardsProfile } from '@/lib/card-reward-routes';
import { isRecord } from '@/lib/runtime-validation';

export const CARD_REWARDS_QUERY_KEY = 'CARD_REWARDS';

type CardRewardsResponse =
  | { status: 'ready'; profile: CardRewardsProfile }
  | { status: 'pending' | 'none' };

/**
 * Where the user's card spending goes, from the accounts they linked through Plaid —
 * the input to the card-rewards routes. No cards are typed in anywhere: linking a
 * bank already names them. Null until a bank is linked and its history is ready.
 */
export function useCardRewards(): { profile: CardRewardsProfile | null; isLoading: boolean } {
  const { getToken, isSignedIn, userId } = useAuth();

  const query = useQuery({
    queryKey: [CARD_REWARDS_QUERY_KEY, userId],
    enabled: Boolean(isSignedIn),
    // Spending patterns move over weeks; there is no reason to pull 90 days of
    // history more than a few times a day.
    staleTime: 6 * 60 * 60 * 1_000,
    // A freshly linked bank is still pulling its history. Ask again shortly.
    refetchInterval: (current) => (current.state.data?.status === 'pending' ? 30_000 : false),
    queryFn: async (): Promise<CardRewardsResponse> => {
      const token = await getToken();
      const response = await fetch(`${apiBaseUrl()}/api/plaid/card-rewards`, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      if (!response.ok) return { status: 'none' };
      const payload: unknown = await response.json().catch(() => null);
      if (!isRecord(payload)) return { status: 'none' };
      if (payload.status === 'ready' && isRecord(payload.profile)) {
        return { status: 'ready', profile: payload.profile as unknown as CardRewardsProfile };
      }
      return { status: payload.status === 'pending' ? 'pending' : 'none' };
    },
  });

  const data = query.data;
  return { profile: data?.status === 'ready' ? data.profile : null, isLoading: query.isLoading };
}
