/**
 * Plaid's REST API, signed with this server's client id and secret. Those must never
 * ship in the app, which is why every Plaid call goes through here.
 */

export function isPlaidConfigured(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

/** POSTs `body` to a Plaid endpoint (e.g. '/link/token/create') with the credentials added. */
export function plaidFetch(path: string, body: Record<string, unknown>): Promise<Response> {
  const env = process.env.PLAID_ENV ?? 'sandbox';
  return fetch(`https://${env}.plaid.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: process.env.PLAID_CLIENT_ID, secret: process.env.PLAID_SECRET, ...body }),
  });
}
