import { isRecord, stringList, stringOrNull } from '@/lib/runtime-validation';
import { HttpError, withAuth } from '@/server/shared/http';
import { profileFor, upsertProfile, type ProfileRow } from '@/server/users/queries';

export interface UserProfilePayload {
  ageRange: string | null;
  country: string | null;
  financialGoal: string | null;
  investingExperience: string | null;
  marketsInterested: string[];
  signupReason: string | null;
  investmentAmount: string | null;
  completed: boolean;
  bankConnected: boolean;
}

function toPayload(row: ProfileRow | undefined): UserProfilePayload {
  return {
    ageRange: row?.ageRange ?? null,
    country: row?.country ?? null,
    financialGoal: row?.financialGoal ?? null,
    investingExperience: row?.investingExperience ?? null,
    marketsInterested: row?.marketsInterested ?? [],
    signupReason: row?.signupReason ?? null,
    investmentAmount: row?.investmentAmount ?? null,
    completed: row?.profileCompletedAt != null,
    bankConnected: row?.bankConnected ?? false,
  };
}


export const getProfile = withAuth('profile', async (_request, userId) => {
  return Response.json(toPayload(await profileFor(userId)));
});

export const saveProfile = withAuth('profile', async (request, userId) => {
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body)) throw new HttpError(400, 'Invalid body');

  const row = await upsertProfile(userId, {
    ageRange: stringOrNull(body.ageRange),
    country: stringOrNull(body.country),
    financialGoal: stringOrNull(body.financialGoal),
    investingExperience: stringOrNull(body.investingExperience),
    marketsInterested: stringList(body.marketsInterested),
    signupReason: stringOrNull(body.signupReason),
    investmentAmount: stringOrNull(body.investmentAmount),
    bankConnected: body.bankConnected === true,
  });
  return Response.json(toPayload(row));
});
