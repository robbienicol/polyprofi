import type { PolymarketPickBundle } from '@/api/client/polymarket-pick-types';
import { apiBaseUrl } from '@/lib/api-base-url';
import { createInFlightCache } from '@/lib/in-flight-cache';
import { isRecord, responseJson } from '@/lib/runtime-validation';

const EMPTY_BUNDLE: PolymarketPickBundle = { taggedEvents: [], commentPicks: [], edges: [], whaleTrades: [] };

function isPolymarketPickBundle(value: unknown): value is PolymarketPickBundle {
  return isRecord(value)
    && Array.isArray(value.taggedEvents)
    && Array.isArray(value.commentPicks)
    && Array.isArray(value.edges)
    && Array.isArray(value.whaleTrades);
}

// Short client-side TTL only to coalesce bursts on this device (e.g. prefetch during
// the quiz immediately followed by the real search) — the data itself is refreshed
// at most once a day, server-side, in `/api/polymarket-picks+api.ts`.
const getPolymarketPickBundle = createInFlightCache<PolymarketPickBundle>(90 * 1000);

export async function fetchPolymarketPickBundle(): Promise<PolymarketPickBundle> {
  return getPolymarketPickBundle(fetchFromServer, 'pm:picks');
}

async function fetchFromServer(): Promise<PolymarketPickBundle> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/polymarket-picks`);
    if (!res.ok) {
      console.warn(`[pm:picks] server error ${res.status}`);
      return EMPTY_BUNDLE;
    }
    const payload = await responseJson(res);
    if (!isPolymarketPickBundle(payload)) {
      console.warn('[pm:picks] malformed response from server');
      return EMPTY_BUNDLE;
    }
    return payload;
  } catch (e) {
    console.warn(`[pm:picks] ${e instanceof Error ? e.message : String(e)}`);
    return EMPTY_BUNDLE;
  }
}
