import { apiBaseUrl } from '@/lib/api-base-url';
import { responseJson } from '@/lib/runtime-validation';

/**
 * One call to our own API with the session token attached. Returns the parsed JSON, or
 * null for anything that went wrong — no session, a timeout, a non-2xx status — so a
 * caller only has to decide what to fall back to, not how the request failed.
 */

export type TokenProvider = () => Promise<string | null>;

interface ApiRequestOptions {
  getToken?: TokenProvider;
  method?: 'GET' | 'POST';
  body?: unknown;
  timeoutMs?: number;
}

export async function apiRequest(
  path: string,
  { getToken, method = 'GET', body, timeoutMs = 10_000 }: ApiRequestOptions,
): Promise<unknown | null> {
  const token = await getToken?.().catch(() => null);
  if (!token) return null;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : null),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : null),
      signal: abort.signal,
    });
    if (!response.ok) {
      console.warn(`[api] ${method} ${path} → ${response.status}`);
      return null;
    }
    return await responseJson(response);
  } catch (error) {
    console.warn(`[api] ${method} ${path} failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
