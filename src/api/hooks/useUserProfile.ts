import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { UserProfilePayload } from '@/app/api/profile+api';
import { apiBaseUrl } from '@/lib/api-base-url';

export interface UserProfileInput {
  ageRange: string | null;
  country: string | null;
  financialGoal: string | null;
  investingExperience: string | null;
  marketsInterested: string[];
  signupReason: string | null;
  investmentAmount: string | null;
}

function profileQueryKey(userId: string | null | undefined) {
  return ['USER_PROFILE', userId] as const;
}

async function authedFetch(path: string, token: string | null, init?: RequestInit): Promise<Response> {
  return fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token ?? ''}` },
  });
}

export function useUserProfile() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const queryClient = useQueryClient();
  const ready = isLoaded && !!isSignedIn;

  const { data, status } = useQuery({
    queryKey: profileQueryKey(userId),
    queryFn: async (): Promise<UserProfilePayload> => {
      const response = await authedFetch('/api/profile', await getToken());
      if (!response.ok) throw new Error(`Failed to load profile (${response.status})`);
      return response.json();
    },
    enabled: ready,
  });

  const { mutate: saveProfile, isPending: isSaving } = useMutation({
    mutationFn: async (input: UserProfileInput): Promise<UserProfilePayload> => {
      const response = await authedFetch('/api/profile', await getToken(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error(`Failed to save profile (${response.status})`);
      return response.json();
    },
    onSuccess: (payload) => queryClient.setQueryData(profileQueryKey(userId), payload),
  });

  return {
    hasCompletedProfile: data?.completed ?? false,
    isLoading: ready ? status === 'pending' : false,
    profile: data,
    saveProfile,
    isSaving,
  };
}
