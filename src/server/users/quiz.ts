import { isQuizAnswers } from '@/lib/runtime-validation';
import { HttpError, withAuth } from '@/server/shared/http';
import { clearQuizAnswers, quizAnswersFor, saveQuizAnswers } from '@/server/users/queries';
import type { QuizAnswers } from '@/types/bets';

export interface QuizAnswersPayload {
  quizAnswers: QuizAnswers | null;
}

export const getQuiz = withAuth('quiz', async (_request, userId) => {
  const stored = await quizAnswersFor(userId);
  return Response.json({ quizAnswers: isQuizAnswers(stored) ? stored : null });
});

export const saveQuiz = withAuth('quiz', async (request, userId) => {
  const body: unknown = await request.json().catch(() => null);
  if (!isQuizAnswers(body)) throw new HttpError(400, 'Invalid quiz answers');

  const saved = await saveQuizAnswers(userId, body);
  return Response.json({ quizAnswers: saved ?? body });
});

export const clearQuiz = withAuth('quiz', async (_request, userId) => {
  await clearQuizAnswers(userId);
  return Response.json({ quizAnswers: null });
});
