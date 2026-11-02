import AsyncStorage from '@react-native-async-storage/async-storage';

import { apiBaseUrl } from '@/lib/api-base-url';
import { isRecord, parseJson, responseJson } from '@/lib/runtime-validation';
import { SYNCED_KEYS, type SyncedKey } from '@/lib/user-data-keys';

/**
 * Device-first mirror of a few AsyncStorage blobs into Neon (`user_data`).
 *
 * The device stays the source the hooks read. Every write to a synced key marks
 * it dirty and schedules a push; a dirty key is never overwritten by the server.
 * On sign-in, `pullUserData` pushes what is dirty, takes the server's copy of the
 * rest, and seeds the account from pre-sync installs. Last write wins per key.
 */

// Pre-rebrand namespace, same as storage.ts — these are the live keys.
export const SYNCED_STORAGE_KEYS: Record<SyncedKey, string> = {
  bets: 'polyprofit:bets',
  savedRoutes: 'polyprofit:savedRoutes',
  preferences: 'polyprofit:preferences',
  onboardingProfile: 'polyprofit:onboardingProfile',
  portfolioProgress: 'polyprofit:portfolioProgress',
};

/** Which account the synced blobs on this device belong to. */
const OWNER_KEY = 'polyprofit:sync:owner';
const dirtyKey = (key: SyncedKey): string => `polyprofit:sync:dirty:${key}`;

/** The history is rewritten on every price tick; one push a minute is plenty. */
const PUSH_DELAY_MS: Record<SyncedKey, number> = {
  bets: 1_500,
  savedRoutes: 1_500,
  preferences: 1_500,
  onboardingProfile: 1_500,
  portfolioProgress: 60_000,
};

interface SyncSession {
  userId: string;
  getToken: () => Promise<string | null>;
}

let session: SyncSession | null = null;
const timers = new Map<SyncedKey, ReturnType<typeof setTimeout>>();

export function setSyncSession(next: SyncSession | null): void {
  session = next;
  if (!next) {
    timers.forEach(clearTimeout);
    timers.clear();
  }
}

async function request(active: SyncSession, init?: RequestInit): Promise<Response> {
  return fetch(`${apiBaseUrl()}/api/user-data`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${(await active.getToken()) ?? ''}`,
    },
  });
}

/**
 * Called by storage.ts after every write to a synced key. The dirty marker is a
 * fresh token so a push only clears it if no newer write landed meanwhile.
 */
export async function noteLocalWrite(key: SyncedKey): Promise<void> {
  await AsyncStorage.setItem(dirtyKey(key), `${Date.now()}-${Math.random()}`);
  schedulePush(key);
}

function schedulePush(key: SyncedKey): void {
  if (!session) return;
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  timers.set(key, setTimeout(() => {
    timers.delete(key);
    void pushKey(key);
  }, PUSH_DELAY_MS[key]));
}

/** Sends the device copy of one key. True when the server has it. Never throws. */
async function pushKey(key: SyncedKey): Promise<boolean> {
  const active = session;
  if (!active) return false;
  try {
    const [marker, raw] = await Promise.all([
      AsyncStorage.getItem(dirtyKey(key)),
      AsyncStorage.getItem(SYNCED_STORAGE_KEYS[key]),
    ]);
    if (raw == null) return true;
    const response = await request(active, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: `{"key":${JSON.stringify(key)},"value":${raw}}`,
    });
    if (!response.ok) return false;
    if (marker != null && (await AsyncStorage.getItem(dirtyKey(key))) === marker) {
      await AsyncStorage.removeItem(dirtyKey(key));
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Reconciles the device with the signed-in account. Returns the keys whose
 * device copy changed, so the caller can refresh just those queries.
 * Throws when the server can't be read — the caller retries on reconnect.
 */
export async function pullUserData(active: SyncSession): Promise<SyncedKey[]> {
  setSyncSession(active);
  const owner = await AsyncStorage.getItem(OWNER_KEY);
  const changed: SyncedKey[] = [];

  // Another account's data is on this device: it is that account's, not this one's.
  if (owner && owner !== active.userId) {
    await AsyncStorage.multiRemove(SYNCED_KEYS.flatMap((key) => [SYNCED_STORAGE_KEYS[key], dirtyKey(key)]));
    changed.push(...SYNCED_KEYS);
  }
  // Claimed before the network read, not after: when the read failed the device was
  // never claimed, so the next account to sign in inherited this one's positions.
  await AsyncStorage.setItem(OWNER_KEY, active.userId);

  const response = await request(active);
  if (!response.ok) throw new Error(`Failed to load user data (${response.status})`);
  const payload = await responseJson(response);
  const remote = isRecord(payload) && isRecord(payload.values) ? payload.values : {};

  for (const key of SYNCED_KEYS) {
    if (await AsyncStorage.getItem(dirtyKey(key))) {
      await pushKey(key);
      continue;
    }
    if (key in remote) {
      // Re-check: a write may have landed while the GET was in flight.
      if (await AsyncStorage.getItem(dirtyKey(key))) continue;
      await AsyncStorage.setItem(SYNCED_STORAGE_KEYS[key], JSON.stringify(remote[key]));
      changed.push(key);
      continue;
    }
    // Nothing on the server yet: seed it from this device (pre-sync installs).
    const local = await AsyncStorage.getItem(SYNCED_STORAGE_KEYS[key]);
    if (local != null && parseJson(local) != null) await pushKey(key);
  }

  return [...new Set(changed)];
}
