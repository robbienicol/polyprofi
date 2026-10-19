import { and, eq, inArray, sql } from 'drizzle-orm';

import { alertState, db, pushTokens, userData, users } from '@/server/db';

/** Database access for the alerts domain. */

export interface PushUser {
  clerkId: string;
  tokens: string[];
  ledger: unknown;
}

/** Users with a push token, longest-unchecked first. */
export async function pushUsersDue(limit: number): Promise<PushUser[]> {
  return db
    .select({
      clerkId: pushTokens.clerkId,
      tokens: sql<string[]>`array_agg(${pushTokens.token})`,
      ledger: alertState.ledger,
    })
    .from(pushTokens)
    .leftJoin(alertState, eq(alertState.clerkId, pushTokens.clerkId))
    .groupBy(pushTokens.clerkId, alertState.ledger, alertState.checkedAt)
    .orderBy(sql`${alertState.checkedAt} ASC NULLS FIRST`)
    .limit(limit);
}

/** The raw rows alerts are planned from: synced bets and settings, and saved goals. */
export async function alertInputsFor(clerkId: string): Promise<{ blobs: Record<string, unknown>; goalState: unknown }> {
  const [blobRows, [user]] = await Promise.all([
    db.select({ key: userData.key, value: userData.value })
      .from(userData)
      .where(and(eq(userData.clerkId, clerkId), inArray(userData.key, ['bets', 'preferences']))),
    db.select({ savingsGoalState: users.savingsGoalState }).from(users).where(eq(users.clerkId, clerkId)),
  ]);
  return {
    blobs: Object.fromEntries(blobRows.map((row) => [row.key, row.value])),
    goalState: user?.savingsGoalState,
  };
}

export async function saveAlertLedger(clerkId: string, ledger: unknown): Promise<void> {
  const checkedAt = new Date().toISOString();
  await db.insert(alertState)
    .values({ clerkId, ledger, checkedAt })
    .onConflictDoUpdate({ target: alertState.clerkId, set: { ledger, checkedAt } });
}
