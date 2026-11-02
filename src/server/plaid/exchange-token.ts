import { isRecord, responseJson } from '@/lib/runtime-validation';
import { isPlaidConfigured, plaidFetch } from '@/server/plaid/client';
import { markBankConnected, savePlaidItem } from '@/server/plaid/queries';
import { HttpError, withAuth } from '@/server/shared/http';

/**
 * The second half of Link: trades the short-lived `public_token` Link handed
 * back on the device for a permanent `access_token`, then stores the item.
 * Not upserted against `users` — a quiz page this early can run before that
 * row exists (plaid_items has no foreign key to it; see db/schema).
 */
export const exchangeToken = withAuth('plaid/exchange-token', async (request, userId) => {
  const body: unknown = await request.json().catch(() => null);
  const publicToken = isRecord(body) && typeof body.publicToken === 'string' ? body.publicToken : null;
  const institutionId = isRecord(body) && typeof body.institutionId === 'string' ? body.institutionId : null;
  const institutionName = isRecord(body) && typeof body.institutionName === 'string' ? body.institutionName : null;
  if (!publicToken) throw new HttpError(400, 'Missing public token');
  if (!isPlaidConfigured()) throw new HttpError(503, 'Bank connect is not configured');

  try {
    const plaidResponse = await plaidFetch('/item/public_token/exchange', { public_token: publicToken });

    if (!plaidResponse.ok) {
      const errorBody = await responseJson(plaidResponse).catch(() => null);
      console.warn(`[api:plaid/exchange-token] Plaid error ${plaidResponse.status}`, errorBody);
      return Response.json({ error: 'Could not finish bank connect' }, { status: 502 });
    }

    const payload = await responseJson(plaidResponse);
    const accessToken = isRecord(payload) && typeof payload.access_token === 'string' ? payload.access_token : null;
    const itemId = isRecord(payload) && typeof payload.item_id === 'string' ? payload.item_id : null;
    if (!accessToken || !itemId) return Response.json({ error: 'Plaid returned no item' }, { status: 502 });

    await savePlaidItem(userId, { itemId, accessToken, institutionId, institutionName });
    await markBankConnected(userId);

    return Response.json({ connected: true });
  } catch (error) {
    console.warn(`[api:plaid/exchange-token] ${error instanceof Error ? error.message : String(error)}`);
    return Response.json({ error: 'Could not finish bank connect' }, { status: 502 });
  }
});
