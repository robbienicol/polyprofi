import { eq } from 'drizzle-orm';

import { alertState, db, plaidItems, pushTokens, userData, users } from '@/server/db';

/** Database access for the account domain. */

/** Every row the account owns, child tables first and the `users` row last. */
export async function deleteAccountRows(clerkId: string): Promise<void> {
  await db.delete(plaidItems).where(eq(plaidItems.clerkId, clerkId));
  await db.delete(userData).where(eq(userData.clerkId, clerkId));
  await db.delete(pushTokens).where(eq(pushTokens.clerkId, clerkId));
  await db.delete(alertState).where(eq(alertState.clerkId, clerkId));
  await db.delete(users).where(eq(users.clerkId, clerkId));
}
