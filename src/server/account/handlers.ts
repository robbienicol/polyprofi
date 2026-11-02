import { createClerkClient } from '@clerk/backend';

import { deleteAccountRows } from '@/server/account/queries';
import { isPlaidConfigured, plaidFetch } from '@/server/plaid/client';
import { plaidAccessTokens } from '@/server/plaid/queries';
import { withAuth } from '@/server/shared/http';

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

/**
 * Revokes one bank connection at Plaid, so the access token stops working there
 * and not just in our table. Best effort: a Plaid outage must not leave the user
 * unable to delete their account, and the row is deleted regardless below.
 */
async function removePlaidItem(accessToken: string): Promise<void> {
  if (!isPlaidConfigured()) return;
  try {
    const response = await plaidFetch('/item/remove', { access_token: accessToken });
    if (!response.ok) console.warn(`[api:account] Plaid item/remove failed (${response.status})`);
  } catch (error) {
    console.warn('[api:account] Plaid item/remove failed', error);
  }
}

/**
 * Permanently deletes the signed-in user's account: their bank connections (revoked
 * at Plaid, then removed from `plaid_items`), their `users` row in Neon and their
 * Clerk identity itself. Required for Apple guideline 5.1.1(v) — apps that support
 * account creation must let users delete their account in-app. Bank access tokens
 * outliving the account was a data-retention hole: they grant read access to the
 * user's transactions.
 */
export const deleteAccount = withAuth('account', async (_request, userId) => {
  const accessTokens = await plaidAccessTokens(userId);
  await Promise.all(accessTokens.map(removePlaidItem));
  await deleteAccountRows(userId);
  await clerkClient.users.deleteUser(userId);

  return Response.json({ deleted: true });
});
