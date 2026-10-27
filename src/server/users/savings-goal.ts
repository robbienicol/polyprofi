import { isSavingsGoalState } from '@/lib/runtime-validation';
import { HttpError, withAuth } from '@/server/shared/http';
import { saveSavingsGoal as upsertSavingsGoal, savingsGoalFor } from '@/server/users/queries';
import type { SavingsGoalState } from '@/types/bets';

export interface SavingsGoalPayload {
  savingsGoalState: SavingsGoalState | null;
}

export const getSavingsGoal = withAuth('savings-goal', async (_request, userId) => {
  const stored = await savingsGoalFor(userId);
  return Response.json({ savingsGoalState: isSavingsGoalState(stored) ? stored : null });
});

export const saveSavingsGoal = withAuth('savings-goal', async (request, userId) => {
  const body: unknown = await request.json().catch(() => null);
  if (!isSavingsGoalState(body)) throw new HttpError(400, 'Invalid savings goal');

  const saved = await upsertSavingsGoal(userId, body);
  return Response.json({ savingsGoalState: saved ?? body });
});
