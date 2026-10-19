import { fetchMarketContext } from '@/api/client/market-data';
import { fetchPolymarketSnapshot } from '@/api/client/polymarket-market-data';
import { apiBaseUrl } from '@/lib/api-base-url';
import { filterRoutesForQuiz } from '@/lib/quiz-profile';
import { buildRoutePool } from '@/lib/route-pool';
import { isRecord, isRoute, responseJson } from '@/lib/runtime-validation';
import { withTimeout } from '@/lib/with-timeout';
import type { Route, RouteParams } from '@/types/routes';

/**
 * The routes for a search: the server's shared pool for this goal, narrowed to the
 * user's own filters. One request, where the device used to make ~45 of its own.
 */

type TokenProvider = () => Promise<string | null>;

/** Long enough for a cold pool build on the server; past it the device builds its own. */
const SERVER_TIMEOUT_MS = 12_000;
const LOCAL_TIMEOUT_MS = 20_000;

const inflight = new Map<string, Promise<Route[]>>();

function requestKey(params: RouteParams): string {
  return JSON.stringify({ ...params, categories: [...params.categories].sort() });
}

export function fetchRoutes(params: RouteParams, options: { getToken?: TokenProvider } = {}): Promise<Route[]> {
  const key = requestKey(params);
  const existing = inflight.get(key);
  if (existing) return existing;
  const request = (async () => {
    const pool = await fetchServerPool(params, options.getToken) ?? await buildPoolOnDevice(params);
    // filterRoutesForQuiz (including the timeframe cutoff) runs on every pool, live
    // Polymarket routes too — otherwise two-year contracts showed up on a one-week search.
    return filterRoutesForQuiz(pool, params);
  })().finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
}

/** The shared pool, or null when the server can't be reached in time. */
async function fetchServerPool(params: RouteParams, getToken?: TokenProvider): Promise<Route[] | null> {
  const token = await getToken?.().catch(() => null);
  if (!token) return null;
  const query = new URLSearchParams({
    balance: String(params.balance),
    target: String(params.target),
    timeframe: params.timeframe,
  });
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), SERVER_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiBaseUrl()}/api/route-pool?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: abort.signal,
    });
    if (!response.ok) {
      console.warn(`[routes] server pool unavailable (${response.status}) — building on device`);
      return null;
    }
    const payload = await responseJson(response);
    const routes = isRecord(payload) && Array.isArray(payload.routes) ? payload.routes.filter(isRoute) : [];
    return routes.length > 0 ? routes : null;
  } catch (error) {
    console.warn(`[routes] server pool failed — building on device: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The fallback when the server is down: the same builder, fed from the public feeds
 * directly. No AI slate and no option chains — both come only from our server.
 */
async function buildPoolOnDevice(params: RouteParams): Promise<Route[]> {
  const polymarket = await withTimeout(
    fetchPolymarketSnapshot(),
    LOCAL_TIMEOUT_MS,
    { context: [], universe: [] },
    'routes:polymarket-snapshot',
  );
  const market = await withTimeout(
    fetchMarketContext({ polymarket: Promise.resolve(polymarket.context) }),
    LOCAL_TIMEOUT_MS,
    { polymarket: [], stocks: [], metaculus: [], treasuryBillYields: [], fetchedAt: new Date().toISOString() },
    'routes:market-context',
  );
  return buildRoutePool({ market, universe: polymarket.universe, optionChains: [], aiSlate: [] }, params);
}
