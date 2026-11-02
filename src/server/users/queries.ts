import { and, eq, sql } from 'drizzle-orm';

import { db, pushTokens, userData, users } from '@/server/db';

/** Database access for the users domain: profile, quiz, savings goal, synced blobs, push tokens. */

const profileColumns = {
  ageRange: users.ageRange,
  country: users.country,
  financialGoal: users.financialGoal,
  investingExperience: users.investingExperience,
  marketsInterested: users.marketsInterested,
  signupReason: users.signupReason,
  investmentAmount: users.investmentAmount,
  profileCompletedAt: users.profileCompletedAt,
  bankConnected: users.bankConnected,
};

export interface ProfileRow {
  ageRange: string | null;
  country: string | null;
  financialGoal: string | null;
  investingExperience: string | null;
  marketsInterested: string[] | null;
  signupReason: string | null;
  investmentAmount: string | null;
  profileCompletedAt: string | null;
  bankConnected: boolean;
}

export type ProfileInput = Omit<ProfileRow, 'profileCompletedAt' | 'marketsInterested'> & { marketsInterested: string[] };

export async function profileFor(clerkId: string): Promise<ProfileRow | undefined> {
  const [row] = await db.select(profileColumns).from(users).where(eq(users.clerkId, clerkId));
  return row;
}

/** Saves the onboarding profile and marks it completed now. */
export async function upsertProfile(clerkId: string, input: ProfileInput): Promise<ProfileRow | undefined> {
  const completedAt = new Date().toISOString();
  const [row] = await db.insert(users)
    .values({ clerkId, ...input, profileCompletedAt: completedAt })
    .onConflictDoUpdate({
      target: users.clerkId,
      set: {
        ageRange: input.ageRange,
        country: input.country,
        financialGoal: input.financialGoal,
        investingExperience: input.investingExperience,
        marketsInterested: input.marketsInterested,
        signupReason: input.signupReason,
        investmentAmount: input.investmentAmount,
        profileCompletedAt: completedAt,
        // Once true, stays true: a later save (e.g. re-running onboarding without
        // reconnecting) must not erase a bank connection that already happened.
        bankConnected: sql`users.bank_connected OR excluded.bank_connected`,
      },
    })
    .returning(profileColumns);
  return row;
}

export async function quizAnswersFor(clerkId: string): Promise<unknown> {
  const [row] = await db.select({ quizAnswers: users.quizAnswers }).from(users).where(eq(users.clerkId, clerkId));
  return row?.quizAnswers;
}

export async function saveQuizAnswers(clerkId: string, quizAnswers: unknown): Promise<unknown> {
  const [row] = await db.insert(users)
    .values({ clerkId, quizAnswers })
    .onConflictDoUpdate({ target: users.clerkId, set: { quizAnswers } })
    .returning({ quizAnswers: users.quizAnswers });
  return row?.quizAnswers;
}

export async function clearQuizAnswers(clerkId: string): Promise<void> {
  await db.update(users).set({ quizAnswers: null }).where(eq(users.clerkId, clerkId));
}

export async function savingsGoalFor(clerkId: string): Promise<unknown> {
  const [row] = await db.select({ savingsGoalState: users.savingsGoalState }).from(users).where(eq(users.clerkId, clerkId));
  return row?.savingsGoalState;
}

export async function saveSavingsGoal(clerkId: string, savingsGoalState: unknown): Promise<unknown> {
  const [row] = await db.insert(users)
    .values({ clerkId, savingsGoalState })
    .onConflictDoUpdate({ target: users.clerkId, set: { savingsGoalState } })
    .returning({ savingsGoalState: users.savingsGoalState });
  return row?.savingsGoalState;
}

export async function userDataFor(clerkId: string): Promise<{ key: string; value: unknown }[]> {
  return db.select({ key: userData.key, value: userData.value }).from(userData).where(eq(userData.clerkId, clerkId));
}

/** Replaces one synced blob. Last write wins. */
export async function saveUserData(clerkId: string, key: string, value: unknown): Promise<void> {
  const updatedAt = new Date().toISOString();
  await db.insert(userData)
    .values({ clerkId, key, value, updatedAt })
    .onConflictDoUpdate({ target: [userData.clerkId, userData.key], set: { value, updatedAt } });
}

export async function removePushToken(clerkId: string, token: string): Promise<void> {
  await db.delete(pushTokens).where(and(eq(pushTokens.token, token), eq(pushTokens.clerkId, clerkId)));
}

/** A token moving to a new account follows the newest sign-in. */
export async function savePushToken(clerkId: string, token: string, platform: string): Promise<void> {
  const updatedAt = new Date().toISOString();
  await db.insert(pushTokens)
    .values({ token, clerkId, platform, updatedAt })
    .onConflictDoUpdate({ target: pushTokens.token, set: { clerkId, platform, updatedAt } });
}
