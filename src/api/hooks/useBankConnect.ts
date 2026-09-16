import { useAuth } from '@clerk/clerk-expo';
import { useCallback, useState } from 'react';
import { createPlaidLinkSession, type LinkSuccess } from 'react-native-plaid-link-sdk';

import { apiBaseUrl } from '@/lib/api-base-url';
import { isRecord } from '@/lib/runtime-validation';

async function authedFetch(path: string, token: string | null, init?: RequestInit): Promise<Response> {
  return fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers, Authorization: `Bearer ${token ?? ''}` },
  });
}

/**
 * Runs the whole Plaid Link round trip from one call: fetch a link_token,
 * open Link, then exchange whatever it returns for a stored item. The quiz
 * page only ever sees `connect()`, `connecting`, `connected`, and `error`.
 *
 * No SDK import above the `expo-dev-client` line runs in Expo Go — Link ships
 * custom native code, so this hook is dead on arrival there. That's expected
 * during this build; see AGENTS.md in react-native-plaid-link-sdk.
 */
export function useBankConnect(): {
  connect: () => Promise<void>;
  connecting: boolean;
  connected: boolean;
  error: string | null;
} {
  const { getToken } = useAuth();
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    if (connecting) return;
    setConnecting(true);
    setError(null);

    try {
      const token = await getToken();
      const tokenResponse = await authedFetch('/api/plaid/link-token', token, { method: 'POST' });
      const tokenPayload: unknown = await tokenResponse.json().catch(() => null);
      const linkToken = isRecord(tokenPayload) && typeof tokenPayload.linkToken === 'string'
        ? tokenPayload.linkToken
        : null;
      if (!tokenResponse.ok || !linkToken) throw new Error('Could not start bank connect');

      const success = await new Promise<LinkSuccess>((resolve, reject) => {
        void createPlaidLinkSession({
          token: linkToken,
          onSuccess: resolve,
          onExit: (exit) => {
            // A plain user-initiated close is not an error — no message, no retry
            // needed. An actual Link failure carries its own error payload.
            if (exit.error) reject(new Error(exit.error.errorMessage || 'Bank connect failed'));
            else reject(null);
          },
          onEvent: () => {},
        }).then((session) => session.open());
      });

      const exchangeResponse = await authedFetch('/api/plaid/exchange-token', token, {
        method: 'POST',
        body: JSON.stringify({
          publicToken: success.publicToken,
          institutionId: success.metadata.institution?.id ?? null,
          institutionName: success.metadata.institution?.name ?? null,
        }),
      });
      if (!exchangeResponse.ok) throw new Error('Could not finish bank connect');

      setConnected(true);
    } catch (thrown) {
      // `null` is the "user closed Link on their own" case above — not a failure.
      if (thrown !== null) setError(thrown instanceof Error ? thrown.message : 'Bank connect failed');
    } finally {
      setConnecting(false);
    }
  }, [connecting, getToken]);

  return { connect, connecting, connected, error };
}
