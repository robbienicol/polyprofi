import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { clearQuizAnswers, getQuizAnswers, setQuizAnswers } from '@/api/client/storage';
import { QuizAnswers } from '@/types/bets';

function quizQueryKey() {
  return ['QUIZ_ANSWERS'] as const;
}

export function useQuizAnswers() {
  const queryClient = useQueryClient();

  const { data: quizAnswers, status } = useQuery({
    queryKey: quizQueryKey(),
    queryFn: getQuizAnswers,
  });

  const { mutate: saveAnswers } = useMutation({
    mutationFn: (answers: QuizAnswers) => setQuizAnswers(answers),
    onSettled: () => queryClient.invalidateQueries({ queryKey: quizQueryKey() }),
  });

  const { mutate: resetQuiz } = useMutation({
    mutationFn: clearQuizAnswers,
    onSettled: () => queryClient.invalidateQueries({ queryKey: quizQueryKey() }),
  });

  return {
    quizAnswers: quizAnswers ?? null,
    hasCompletedQuiz: !!quizAnswers,
    isLoading: status === 'pending',
    saveAnswers,
    resetQuiz,
  };
}
