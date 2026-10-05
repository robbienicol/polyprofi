import { createClerkClient, verifyToken } from '@clerk/backend';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_DATABASE_URL!);
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

async function requireUserId(request: Request): Promise<string | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY! });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Revokes one bank connection at Plaid, so the access token stops working there
 * and not just in our table. Best effort: a Plaid outage must not leave the user
 * unable to delete their account, and the row is deleted regardless below.
 */
async function removePlaidItem(accessToken: string): Promise<void> {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = process.env.PLAID_ENV ?? 'sandbox';
  if (!clientId || !secret) return;
  try {
    const response = await fetch(`https://${env}.plaid.com/item/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, secret, access_token: accessToken }),
    });
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
export async function DELETE(request: Request): Promise<Response> {
  const userId = await requireUserId(request);
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const items = (await sql`SELECT access_token FROM plaid_items WHERE clerk_id = ${userId}`) as {
    access_token: string;
  }[];
  await Promise.all(items.map((item) => removePlaidItem(item.access_token)));
  await sql`DELETE FROM plaid_items WHERE clerk_id = ${userId}`;
  await sql`DELETE FROM user_data WHERE clerk_id = ${userId}`;
  await sql`DELETE FROM users WHERE clerk_id = ${userId}`;
  await clerkClient.users.deleteUser(userId);

  return Response.json({ deleted: true });
}
