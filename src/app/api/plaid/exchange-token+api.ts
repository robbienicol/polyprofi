import { neon } from '@neondatabase/serverless';

import { isRecord, responseJson } from '@/lib/runtime-validation';
import { authenticatedUserId } from '@/lib/server-auth';

const sql = neon(process.env.NEON_DATABASE_URL!);

/**
 * The second half of Link: trades the short-lived `public_token` Link handed
 * back on the device for a permanent `access_token`, then stores the item.
 * Not upserted against `users` — a quiz page this early can run before that
 * row exists (see migrations/20260911_add_plaid_items.sql).
 */
export async function POST(request: Request): Promise<Response> {
  const userId = await authenticatedUserId(request);
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const publicToken = isRecord(body) && typeof body.publicToken === 'string' ? body.publicToken : null;
  const institutionId = isRecord(body) && typeof body.institutionId === 'string' ? body.institutionId : null;
  const institutionName = isRecord(body) && typeof body.institutionName === 'string' ? body.institutionName : null;
  if (!publicToken) return Response.json({ error: 'Missing public token' }, { status: 400 });

  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = process.env.PLAID_ENV ?? 'sandbox';
  if (!clientId || !secret) return Response.json({ error: 'Bank connect is not configured' }, { status: 503 });

  try {
    const plaidResponse = await fetch(`https://${env}.plaid.com/item/public_token/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, secret, public_token: publicToken }),
    });

    if (!plaidResponse.ok) {
      const errorBody = await responseJson(plaidResponse).catch(() => null);
      console.warn(`[api:plaid/exchange-token] Plaid error ${plaidResponse.status}`, errorBody);
      return Response.json({ error: 'Could not finish bank connect' }, { status: 502 });
    }

    const payload = await responseJson(plaidResponse);
    const accessToken = isRecord(payload) && typeof payload.access_token === 'string' ? payload.access_token : null;
    const itemId = isRecord(payload) && typeof payload.item_id === 'string' ? payload.item_id : null;
    if (!accessToken || !itemId) return Response.json({ error: 'Plaid returned no item' }, { status: 502 });

    await sql`
      INSERT INTO plaid_items (clerk_id, item_id, access_token, institution_id, institution_name)
      VALUES (${userId}, ${itemId}, ${accessToken}, ${institutionId}, ${institutionName})
      ON CONFLICT (item_id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        institution_id = EXCLUDED.institution_id,
        institution_name = EXCLUDED.institution_name
    `;

    return Response.json({ connected: true });
  } catch (error) {
    console.warn(`[api:plaid/exchange-token] ${error instanceof Error ? error.message : String(error)}`);
    return Response.json({ error: 'Could not finish bank connect' }, { status: 502 });
  }
}
