import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { clearQuizAnswers, getQuizAnswers, setQuizAnswers } from '@/api/client/storage';
import { deviceQuery } from '@/api/query-client';
import { apiBaseUrl } from '@/lib/api-base-url';
import { isQuizAnswers, isRecord, responseJson } from '@/lib/runtime-validation';
import type { QuizAnswers } from '@/types/bets';

function quizQueryKey(userId: string | null | undefined) {
  return ['QUIZ_ANSWERS', userId ?? 'local'] as const;
}

function parseQuizPayload(value: unknown): QuizAnswers | null {
  if (!isRecord(value)) return null;
  return value.quizAnswers === null || isQuizAnswers(value.quizAnswers)
    ? value.quizAnswers
    : null;
}

export function useQuizAnswers() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const queryClient = useQueryClient();
  const signedIn = isLoaded && !!isSignedIn && !!userId;
  const queryKey = quizQueryKey(userId);

  const request = async (init?: RequestInit): Promise<Response> => fetch(`${apiBaseUrl()}/api/quiz`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${(await getToken()) ?? ''}`,
    },
  });

  const { data: quizAnswers, status } = useQuery({
    queryKey,
    enabled: isLoaded,
    queryFn: async (): Promise<QuizAnswers | null> => {
      const local = await getQuizAnswers(signedIn ? userId : undefined);
      if (!signedIn) return local;

      try {
        const response = await request();
        if (!response.ok) throw new Error(`Failed to load quiz answers (${response.status})`);
        const remote = parseQuizPayload(await responseJson(response));
        if (remote) {
          await setQuizAnswers(remote, userId);
          return remote;
        }

        // Existing installs already have an unscoped on-device value. Seed it into
        // the signed-in user's backend record once, then mark the cache as theirs.
        if (local) {
          const migration = await request({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(local),
          });
          if (migration.ok) await setQuizAnswers(local, userId);
        }
        return local;
      } catch {
        return local;
      }
    },
    // Answers only change through the mutations below, both of which write the
    // cache themselves. Refetching on every mount just re-ran the backend sync.
    ...deviceQuery,
  });

  const { mutate: saveAnswers } = useMutation({
    mutationFn: async (answers: QuizAnswers): Promise<QuizAnswers> => {
      // The on-device write is the one that matters — it's what the routes screen
      // reads. Backend sync is best effort: a flaky /api/quiz must not strand the
      // caller (the quiz button waits on onSuccess to navigate, so a throw here
      // used to leave it stuck on "Finding routes…" forever).
      await setQuizAnswers(answers, signedIn ? userId : undefined);
      if (signedIn) {
        try {
          const response = await request({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(answers),
          });
          if (!response.ok) console.warn(`[quiz] sync failed (${response.status})`);
        } catch (error) {
          console.warn(`[quiz] sync failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      return answers;
    },
    // The routes screen reads these answers the instant the quiz navigates away,
    // and the backend sync inside mutationFn can take a second on a bad network.
    onMutate: async (answers) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<QuizAnswers | null>(queryKey);
      queryClient.setQueryData(queryKey, answers);
      return { previous };
    },
    onError: (_error, _answers, context) => {
      queryClient.setQueryData(queryKey, context?.previous ?? null);
    },
  });

  const { mutate: resetQuiz } = useMutation({
    mutationFn: async (): Promise<void> => {
      await clearQuizAnswers();
      if (signedIn) {
        const response = await request({ method: 'DELETE' });
        if (!response.ok) throw new Error(`Failed to reset quiz answers (${response.status})`);
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<QuizAnswers | null>(queryKey);
      queryClient.setQueryData(queryKey, null);
      return { previous };
    },
    // A failed reset must not leave the app claiming the quiz was never taken.
    onError: (_error, _input, context) => {
      queryClient.setQueryData(queryKey, context?.previous ?? null);
    },
  });

  return {
    quizAnswers: quizAnswers ?? null,
    hasCompletedQuiz: !!quizAnswers,
    isLoading: !isLoaded || status === 'pending',
    saveAnswers,
    resetQuiz,
  };
}
