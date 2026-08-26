import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getProfileCompleted, setProfileCompleted } from '@/api/client/storage';
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

/**
 * The one-time profile survey's completion state.
 *
 * This gates a redirect in `app/index.tsx`, so "we couldn't find out" must not
 * collapse into "not completed". It used to: a failed `/api/profile` load left
 * `data` undefined, which read as incomplete and sent the user back through the
 * survey — on every cold start, since the query cache is in memory only. In a
 * production build with `EXPO_PUBLIC_API_BASE_URL` unset, `apiBaseUrl()` returns
 * '' and every one of these calls fails, so the survey reappeared forever.
 *
 * Now a successful load caches the flag on device, a failed load falls back to
 * that cache, and `checkFailed` lets the caller skip the redirect entirely when
 * the answer is genuinely unknown.
 */
export function useUserProfile() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const queryClient = useQueryClient();
  const ready = isLoaded && !!isSignedIn;

  const { data, status } = useQuery({
    queryKey: profileQueryKey(userId),
    queryFn: async (): Promise<{ payload: UserProfilePayload | null; completed: boolean; reachable: boolean }> => {
      const cached = await getProfileCompleted(userId ?? undefined);
      try {
        const response = await authedFetch('/api/profile', await getToken());
        if (!response.ok) throw new Error(`Failed to load profile (${response.status})`);
        const payload: UserProfilePayload = await response.json();
        // Only ever promote to completed from the server; never let a stale
        // local 'true' be downgraded by an outage.
        if (payload.completed) await setProfileCompleted(true, userId ?? undefined);
        return { payload, completed: payload.completed, reachable: true };
      } catch {
        return { payload: null, completed: cached, reachable: false };
      }
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
    onSuccess: async (payload) => {
      if (payload.completed) await setProfileCompleted(true, userId ?? undefined);
      queryClient.setQueryData(profileQueryKey(userId), {
        payload,
        completed: payload.completed,
        reachable: true,
      });
    },
  });

  return {
    hasCompletedProfile: data?.completed ?? false,
    /**
     * True when the server couldn't be reached, so `hasCompletedProfile` is a
     * cached guess rather than an answer. Callers gating a one-time flow should
     * not force it on this.
     */
    checkFailed: data ? !data.reachable : false,
    isLoading: ready ? status === 'pending' : false,
    profile: data?.payload ?? undefined,
    saveProfile,
    isSaving,
  };
}
