import { eq } from 'drizzle-orm';

import { db, plaidItems, users } from '@/server/db';

/** Database access for the plaid domain. */

export async function plaidAccessTokens(clerkId: string): Promise<string[]> {
  const rows = await db.select({ accessToken: plaidItems.accessToken }).from(plaidItems).where(eq(plaidItems.clerkId, clerkId));
  return rows.map((row) => row.accessToken);
}

interface PlaidItemInput {
  itemId: string;
  accessToken: string;
  institutionId: string | null;
  institutionName: string | null;
}

export async function savePlaidItem(clerkId: string, item: PlaidItemInput): Promise<void> {
  await db.insert(plaidItems)
    .values({ clerkId, ...item })
    .onConflictDoUpdate({
      target: plaidItems.itemId,
      set: { accessToken: item.accessToken, institutionId: item.institutionId, institutionName: item.institutionName },
    });
}

/**
 * Mirror the connection onto the profile row so every surface that reads
 * `/api/profile` (settings chief among them) shows it as connected, even
 * when the quiz save that would otherwise carry the flag never happens.
 * No-op when the row doesn't exist yet; the quiz's own save sets it then.
 */
export async function markBankConnected(clerkId: string): Promise<void> {
  await db.update(users).set({ bankConnected: true }).where(eq(users.clerkId, clerkId));
}
