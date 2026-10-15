import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import type { LinkSuccess } from 'react-native-plaid-link-sdk';

import { CARD_REWARDS_QUERY_KEY } from '@/api/hooks/useCardRewards';
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
 * Link ships custom native code, so it does not run in Expo Go, and importing it
 * at module load broke the web bundle outright — `requireNativeViewManager` does
 * not exist there, and every screen that so much as imports this hook (the quiz,
 * settings) failed to render. The SDK is therefore pulled in inside `connect()`,
 * where a platform without it can be turned away with a message instead.
 */
export function useBankConnect(): {
  connect: () => Promise<void>;
  connecting: boolean;
  connected: boolean;
  /** Banks and cards linked in this session — each Link run adds one institution. */
  linkedCount: number;
  error: string | null;
} {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [linkedCount, setLinkedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    if (connecting) return;
    setConnecting(true);
    setError(null);

    try {
      if (Platform.OS === 'web') throw new Error('Connect your bank from the Pathey app');
      // Imported here, not at the top: see the note above.
      const { createPlaidLinkSession } = await import('react-native-plaid-link-sdk');
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
      setLinkedCount((count) => count + 1);
      // The server marks the profile row connected as part of the exchange, so
      // re-reading it is what makes settings show the connection on any other
      // screen — and on the next launch, when this hook's state is gone.
      await queryClient.invalidateQueries({ queryKey: ['USER_PROFILE'] });
      // The linked accounts are what the card-rewards routes are built from.
      void queryClient.invalidateQueries({ queryKey: [CARD_REWARDS_QUERY_KEY] });
    } catch (thrown) {
      // `null` is the "user closed Link on their own" case above — not a failure.
      if (thrown !== null) setError(thrown instanceof Error ? thrown.message : 'Bank connect failed');
    } finally {
      setConnecting(false);
    }
  }, [connecting, getToken, queryClient]);

  return { connect, connecting, connected, linkedCount, error };
}
