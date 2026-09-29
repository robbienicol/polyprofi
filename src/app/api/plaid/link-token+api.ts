import { authenticatedUserId } from '@/lib/server-auth';
import { isRecord, responseJson } from '@/lib/runtime-validation';

/**
 * Creates the short-lived `link_token` the client needs before it can open
 * Plaid Link. Has to happen server-side — the client secret this call signs
 * with must never ship in the app (see AGENTS.md in react-native-plaid-link-sdk).
 */
export async function POST(request: Request): Promise<Response> {
  const userId = await authenticatedUserId(request);
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = process.env.PLAID_ENV ?? 'sandbox';
  if (!clientId || !secret) return Response.json({ error: 'Bank connect is not configured' }, { status: 503 });

  try {
    const plaidResponse = await fetch(`https://${env}.plaid.com/link/token/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        secret,
        client_name: 'Pathey',
        language: 'en',
        country_codes: ['US'],
        user: { client_user_id: userId },
        // Transactions is the only product this app has any use for: seeing
        // what someone already spends, to weigh a spending-cut route against
        // a market one. No auth/identity/balance product requested.
        products: ['transactions'],
      }),
    });

    if (!plaidResponse.ok) {
      const errorBody = await responseJson(plaidResponse).catch(() => null);
      console.warn(`[api:plaid/link-token] Plaid error ${plaidResponse.status}`, errorBody);
      return Response.json({ error: 'Could not start bank connect' }, { status: 502 });
    }

    const payload = await responseJson(plaidResponse);
    const linkToken = isRecord(payload) && typeof payload.link_token === 'string' ? payload.link_token : null;
    if (!linkToken) return Response.json({ error: 'Plaid returned no link token' }, { status: 502 });

    return Response.json({ linkToken });
  } catch (error) {
    console.warn(`[api:plaid/link-token] ${error instanceof Error ? error.message : String(error)}`);
    return Response.json({ error: 'Could not start bank connect' }, { status: 502 });
  }
}
