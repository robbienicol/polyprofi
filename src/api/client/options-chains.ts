import type { OptionChain } from '@/api/client/options-chain-types';
import { apiBaseUrl } from '@/lib/api-base-url';
import { isRecord, responseJson } from '@/lib/runtime-validation';

/**
 * Trimmed live option chains from /api/options-chains. Every failure is an empty list:
 * options are one class among many, and a search without them is still a full result.
 */
export async function fetchOptionChains(getToken?: () => Promise<string | null>): Promise<OptionChain[]> {
  if (!getToken) return [];
  try {
    const token = await getToken();
    if (!token) return [];
    const response = await fetch(`${apiBaseUrl()}/api/options-chains`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      console.warn(`[routes:options] server error ${response.status}`);
      return [];
    }
    const payload = await responseJson(response);
    const chains: unknown[] = isRecord(payload) && Array.isArray(payload.chains) ? payload.chains : [];
    return chains.filter(isOptionChain);
  } catch (error) {
    console.warn(`[routes:options] ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

function isOptionChain(value: unknown): value is OptionChain {
  return isRecord(value)
    && typeof value.symbol === 'string'
    && typeof value.price === 'number' && value.price > 0
    && typeof value.ask === 'number'
    && typeof value.asOf === 'string'
    && Array.isArray(value.expiries);
}
