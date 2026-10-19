import type { AlertMessage } from '@/lib/alert-messages';
import { isRecord } from '@/lib/runtime-validation';
import { sql } from '@/server/db';

/**
 * Sends notifications through Expo's push service, which forwards to Apple and
 * Google. Tokens Expo reports as gone (app deleted, notifications revoked) are
 * removed so they aren't tried again.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo accepts at most 100 messages per request. */
const BATCH_SIZE = 100;

export interface PushMessage extends AlertMessage {
  to: string;
}

interface ExpoTicket {
  status?: string;
  details?: { error?: string };
}

export async function sendPush(messages: PushMessage[]): Promise<void> {
  for (let start = 0; start < messages.length; start += BATCH_SIZE) {
    const batch = messages.slice(start, start + BATCH_SIZE);
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        // Only needed once "enhanced push security" is turned on for the project.
        ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : null),
      },
      body: JSON.stringify(batch.map(({ to, title, body, url }) => ({
        to,
        title,
        body,
        sound: 'default',
        ...(url ? { data: { url } } : null),
      }))),
    });
    if (!response.ok) {
      console.warn(`[push] Expo rejected a batch (${response.status})`);
      continue;
    }
    const payload: unknown = await response.json().catch(() => null);
    const tickets: ExpoTicket[] = isRecord(payload) && Array.isArray(payload.data) ? payload.data : [];
    const gone = batch
      .filter((_, index) => tickets[index]?.details?.error === 'DeviceNotRegistered')
      .map((message) => message.to);
    if (gone.length > 0) await sql`DELETE FROM push_tokens WHERE token = ANY(${gone})`;
  }
}
