import { apiRequest, type TokenProvider } from '@/api/client/api-request';
import { fetchAllBetStatuses } from '@/api/client/bet-monitor';
import { fetchTrackedAssetQuotes } from '@/api/client/portfolio-live';
import type { TrackedAssetQuote } from '@/api/client/yahoo-quote';
import { isRecord } from '@/lib/runtime-validation';
import type { BetLiveStatus, TrackedBet } from '@/types/bets';

/**
 * Live prices and statuses for the user's positions, from our server (one request,
 * shared upstream fetches) with the device's own fetches as the fallback.
 */

const TIMEOUT_MS = 10_000;

function listFrom<T>(payload: unknown, field: string, isItem: (value: unknown) => boolean): T[] | null {
  if (!isRecord(payload) || !Array.isArray(payload[field])) return null;
  return (payload[field] as unknown[]).filter(isItem) as T[];
}

const isStatus = (value: unknown) => isRecord(value) && typeof value.betId === 'string';
const isQuote = (value: unknown) => isRecord(value) && typeof value.symbol === 'string' && typeof value.price === 'number';

export async function fetchLiveStatuses(bets: TrackedBet[], getToken?: TokenProvider): Promise<BetLiveStatus[]> {
  const active = bets.filter((bet) => bet.status === 'active');
  if (active.length === 0) return [];
  const payload = await apiRequest('/api/positions/live', { getToken, method: 'POST', body: { bets: active }, timeoutMs: TIMEOUT_MS });
  return listFrom<BetLiveStatus>(payload, 'statuses', isStatus) ?? fetchAllBetStatuses(active);
}

export async function fetchLiveQuotes(symbols: string[], getToken?: TokenProvider): Promise<TrackedAssetQuote[]> {
  if (symbols.length === 0) return [];
  const query = new URLSearchParams({ symbols: symbols.join(',') });
  const payload = await apiRequest(`/api/quotes?${query}`, { getToken, timeoutMs: TIMEOUT_MS });
  return listFrom<TrackedAssetQuote>(payload, 'quotes', isQuote) ?? fetchTrackedAssetQuotes(symbols);
}
