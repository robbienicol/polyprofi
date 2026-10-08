import { fetchMarketContext } from '@/api/client/market-data';
import { fetchPolymarketSnapshot } from '@/api/client/polymarket-market-data';
import { playbookRoutes, targetBucket, timeframeCalendarDays } from '@/api/client/playbook';
import { getDailyPool, setDailyPool } from '@/api/client/storage';
import { applySourcedDebtFacts } from '@/lib/factual-route-data';
import { apiBaseUrl } from '@/lib/api-base-url';
import { buildCryptoRoutes } from '@/lib/crypto-routes';
import { buildPolymarketRoutes } from '@/lib/polymarket-routes';
import { enforceRouteIntegrity, filterRoutesForQuiz } from '@/lib/quiz-profile';
import { buildEtfRoutes } from '@/lib/etf-routes';
import { isDebtRoute } from '@/lib/route-investment-metrics';
import { isRecord, isRoute, responseJson } from '@/lib/runtime-validation';
import { withTimeout } from '@/lib/with-timeout';
import { buildSavingsAccountRoute, buildTreasuryRoutes } from '@/lib/savings-treasury-routes';
import { sortByPatheyScore } from '@/lib/score';
import { stakeNeededForReturn } from '@/lib/stake-rescore';
import type { Route, RouteParams } from '@/types/routes';

const DAILY_POOL_VERSION = 'return-bucket-v3';
// Ceilings on the two halves of a search. Nothing here is load-bearing on its own —
// the deterministic builders alone produce a full result set — so a slow upstream
// costs freshness, never the whole screen.
const MARKET_DATA_TIMEOUT_MS = 20_000;
const AI_TIMEOUT_MS = 45_000;
const inflightRoutes = new Map<string, Promise<Route[]>>();

type TokenProvider = () => Promise<string | null>;

export async function fetchRoutes(
  params: RouteParams,
  options: { force?: boolean; getToken?: TokenProvider } = {},
): Promise<Route[]> {
  const requestKey = routesCacheKey(params);
  const existing = inflightRoutes.get(requestKey);
  if (existing) return existing;
  const goalKey = dailyGoalKey(params);
  const request = (async () => {
    if (!options.force) {
      const cached = await getDailyPool(goalKey).catch(() => null);
      if (cached?.length) return cached;
    }
    const { routes, degraded } = await generateRoutes(params, options.getToken);
    // A pool built without the live prediction-market feed is not a result worth
    // keeping: the daily cache treats any non-empty pool as a hit, so caching one
    // pinned every search in this band to the deterministic stock/treasury routes
    // for the rest of the day after a single slow feed.
    if (degraded) {
      console.warn('[routes] prediction-market feed unavailable — serving this pool without caching it');
    } else {
      await setDailyPool(goalKey, routes).catch(() => undefined);
    }
    return routes;
  })().finally(() => inflightRoutes.delete(requestKey));
  inflightRoutes.set(requestKey, request);
  return request;
}

interface GeneratedPool {
  routes: Route[];
  /** True when the live prediction-market feed came back empty, so the pool is stocks-only. */
  degraded: boolean;
}

async function generateRoutes(params: RouteParams, getToken?: TokenProvider): Promise<GeneratedPool> {
  const { balance, target, timeframe } = params;
  const returnPct = balance > 0 ? (target / balance) * 100 : 0;
  const fallbackMaturity = timeframeCalendarDays(timeframe);
  const polymarketSnapshotRequest = withTimeout(
    fetchPolymarketSnapshot(),
    MARKET_DATA_TIMEOUT_MS,
    { context: [], universe: [] },
    'routes:polymarket-snapshot',
  );
  // Everything here is live market data for the deterministic builders. The AI part
  // is a shared daily slate fetched alongside it — no prompt is built on the device.
  const [marketContext, polymarketSnapshot, aiRoutes] = await Promise.all([
    withTimeout(
      fetchMarketContext({ polymarket: polymarketSnapshotRequest.then((snapshot) => snapshot.context) }),
      MARKET_DATA_TIMEOUT_MS,
      { polymarket: [], stocks: [], metaculus: [], treasuryBillYields: [], fetchedAt: new Date().toISOString() },
      'routes:market-context',
    ),
    polymarketSnapshotRequest,
    requestAiRoutes(params, fallbackMaturity, getToken),
  ]);
  const polymarketUniverse = polymarketSnapshot.universe;
  return {
    routes: mergeAndRankRoutes(aiRoutes, polymarketUniverse, marketContext, params, returnPct, fallbackMaturity),
    degraded: polymarketUniverse.length === 0,
  };
}

// The AI slate only SUPPLEMENTS Polymarket routes — the deterministic builders
// (treasury / ETF / playbook) and the live Polymarket universe cover a full result set on
// their own. So every failure here is non-fatal: log and return [], and let the merge
// proceed.
//
// The slate is generated once a day on the server and shared by every user (see
// /api/ai-routes), so this is a cached read, not a model call. It carries no money:
// each contract is priced here at this search's amount.
async function requestAiRoutes(
  params: RouteParams,
  fallbackMaturity: number,
  getToken?: TokenProvider,
): Promise<Route[]> {
  if (!getToken) {
    console.warn('[routes:ai] no authenticated session — skipping the AI slate');
    return [];
  }
  try {
    const token = await getToken();
    if (!token) return [];
    const abort = new AbortController();
    const abortTimer = setTimeout(() => abort.abort(), AI_TIMEOUT_MS);
    const response = await fetch(`${apiBaseUrl()}/api/ai-routes`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: abort.signal,
    }).finally(() => clearTimeout(abortTimer));
    if (!response.ok) {
      console.warn(`[routes:ai] server error ${response.status}`);
      return [];
    }
    const payload = await responseJson(response);
    const values: unknown[] = isRecord(payload) && Array.isArray(payload.routes) ? payload.routes : [];
    return values.filter(isRoute).map((route) => priceSlateRoute(route, params, fallbackMaturity));
  } catch (error) {
    console.warn(`[routes:ai] ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/** A binary contract bought at price p returns stake × (1/p − 1) if it resolves in your favour. */
function priceSlateRoute(route: Route, params: RouteParams, fallbackMaturity: number): Route {
  const price = route.probability / 100;
  const expectedReturn = price > 0 && price < 1 ? Math.round(params.balance * (1 / price - 1)) : 0;
  return {
    ...route,
    expectedReturn,
    meetsTarget: expectedReturn >= params.target,
    maturesInDays: route.maturesInDays && route.maturesInDays > 0 ? Math.round(route.maturesInDays) : fallbackMaturity,
  };
}

function mergeAndRankRoutes(
  aiRoutes: Route[],
  polymarketUniverse: Awaited<ReturnType<typeof fetchPolymarketSnapshot>>['universe'],
  market: Awaited<ReturnType<typeof fetchMarketContext>>,
  params: RouteParams,
  returnPct: number,
  fallbackMaturity: number
): Route[] {
  const { balance, target, timeframe } = params;
  const baselineRoutes = playbookRoutes(returnPct, timeframe, target, { stocks: market.stocks });
  const treasuryRoutes = buildTreasuryRoutes({ yields: market.treasuryBillYields, balance, target, deadlineDays: fallbackMaturity });
  const savingsAccountRoutes = buildSavingsAccountRoute({ yields: market.treasuryBillYields, balance, target, deadlineDays: fallbackMaturity });
  const etfRoutes = buildEtfRoutes({ quotes: market.stocks, balance, target, deadlineDays: fallbackMaturity });
  const cryptoRoutes = buildCryptoRoutes({ quotes: market.stocks, balance, target, deadlineDays: fallbackMaturity });
  const baselines = treasuryRoutes.length > 0 ? baselineRoutes.filter((route) => !isDebtRoute(route)) : baselineRoutes;
  // The AI is scoped to Polymarket; hard-guard it so a stray stock/treasury route can't slip in
  // and collide with the deterministic builders that own those categories.
  const polymarketAiRoutes = aiRoutes.filter((route) => /polymarket/i.test(route.category));
  const sourced = applySourcedDebtFacts([...treasuryRoutes, ...savingsAccountRoutes, ...etfRoutes, ...cryptoRoutes, ...baselines, ...polymarketAiRoutes], market.stocks, balance, fallbackMaturity, target);
  const tailored = enforceRouteIntegrity(sourced, target);
  const livePolymarket = enforceRouteIntegrity(buildPolymarketRoutes(polymarketUniverse, params), target);
  // filterRoutesForQuiz (including the timeframe cutoff) has to run on the LIVE Polymarket
  // routes too — otherwise a market that missed the horizon quota's grace window still
  // slips into the pool unfiltered, which is how two-year contracts showed up on a
  // one-week search.
  const merged = [...new Map([...tailored, ...livePolymarket].map((route) => [route.id, route])).values()];
  const unique = filterRoutesForQuiz(merged, params);
  return sortByPatheyScore(unique, (route) => ({
    target,
    requiredInvestment: stakeNeededForReturn(route, balance, target),
    availableInvestment: balance,
    deadlineDays: fallbackMaturity,
  }));
}

function routesCacheKey(params: RouteParams): string {
  return JSON.stringify({ ...params, categories: [...params.categories].sort() });
}

// Key the shared daily pool by the calibrated RETURN BAND, not the raw dollar target.
// A $300 and a $305 goal (same band) reuse one generation instead of triggering two —
// collapsing a continuous $ axis into 9 bands is the big cache-hit / token-saving win.
// The exact target is still honored per-user client-side (rescoreForStake + relevance filter).
function dailyGoalKey(params: RouteParams): string {
  const returnPct = params.balance > 0 ? (params.target / params.balance) * 100 : 0;
  return [
    DAILY_POOL_VERSION,
    params.timeframe,
    params.riskTolerance,
    [...params.categories].sort().join(','),
    `r${targetBucket(returnPct)}`,
  ].join('|');
}
