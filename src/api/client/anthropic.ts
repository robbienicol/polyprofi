import type { RawPick } from '@/types/picks';
import {
  fetchMarketContext,
  formatMetaculusContext,
  formatPolymarketContext,
  formatPopularPolymarketContext,
} from '@/api/client/market-data';
import { fetchPolymarketSnapshot } from '@/api/client/polymarket-market-data';
import {
  fetchPolymarketPickBundle,
  formatMetaculusEdges,
  formatPolymarketTaggedEvents,
  formatWhaleTrades,
  whaleTradesToPicks,
} from '@/api/client/polymarket-picks';
import { playbookRoutes, targetBucket, timeframeCalendarDays } from '@/api/client/playbook';
import { buildRouteGenerationPrompt } from '@/api/client/route-generation-prompt';
import { getDailyPool, setDailyPool } from '@/api/client/storage';
import { applySourcedDebtFacts } from '@/lib/factual-route-data';
import { buildCryptoRoutes } from '@/lib/crypto-routes';
import { buildPolymarketRoutes } from '@/lib/polymarket-routes';
import { enforceRouteIntegrity, filterRoutesForQuiz } from '@/lib/quiz-profile';
import { buildEtfRoutes } from '@/lib/etf-routes';
import { isDebtRoute } from '@/lib/route-investment-metrics';
import { isRecord, isRoute, parseJson, responseJson } from '@/lib/runtime-validation';
import { buildTreasuryRoutes } from '@/lib/savings-treasury-routes';
import { sortByPolyProfitScore } from '@/lib/score';
import { stakeNeededForReturn } from '@/lib/stake-rescore';
import type { Route, RouteParams } from '@/types/routes';

const API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';
const DAILY_POOL_VERSION = 'return-bucket-v3';
const TIMEFRAME_LABELS: Record<RouteParams['timeframe'], string> = {
  today: 'today (next 24 hours)',
  week: 'this week (next 7 days)',
  month: 'this month (next 30 days)',
  '3months': 'the next 3 months',
  '1year': 'the next 12 months',
  '5years': 'the next 5 years',
};
const inflightRoutes = new Map<string, Promise<Route[]>>();

export async function fetchRoutes(params: RouteParams, options: { force?: boolean } = {}): Promise<Route[]> {
  const requestKey = routesCacheKey(params);
  const existing = inflightRoutes.get(requestKey);
  if (existing) return existing;
  const goalKey = dailyGoalKey(params);
  const request = (async () => {
    if (!options.force) {
      const cached = await getDailyPool(goalKey).catch(() => null);
      if (cached?.length) return cached;
    }
    const routes = await generateRoutes(params);
    await setDailyPool(goalKey, routes).catch(() => undefined);
    return routes;
  })().finally(() => inflightRoutes.delete(requestKey));
  inflightRoutes.set(requestKey, request);
  return request;
}

async function generateRoutes(params: RouteParams): Promise<Route[]> {
  const { balance, target, timeframe } = params;
  const returnPct = balance > 0 ? (target / balance) * 100 : 0;
  const fallbackMaturity = timeframeCalendarDays(timeframe);
  const polymarketSnapshotRequest = fetchPolymarketSnapshot();
  const [marketContext, polymarketSnapshot, polymarketPicks] = await Promise.all([
    fetchMarketContext({ polymarket: polymarketSnapshotRequest.then((snapshot) => snapshot.context) }),
    polymarketSnapshotRequest,
    fetchPolymarketPickBundle(),
  ]);
  const polymarketUniverse = polymarketSnapshot.universe;
  const rawPicks: RawPick[] = [
    ...polymarketPicks.commentPicks,
    ...whaleTradesToPicks(polymarketPicks.whaleTrades),
  ];
  const prompt = buildRouteGenerationPrompt({
    params,
    timeframeLabel: TIMEFRAME_LABELS[timeframe],
    returnPct,
    blocks: {
      picks: formatRawPicks(rawPicks),
      polymarket: formatPolymarketContext(marketContext.polymarket),
      popularPolymarket: formatPopularPolymarketContext(polymarketUniverse.slice(0, 40)),
      metaculus: formatMetaculusContext(marketContext.metaculus),
      taggedPolymarket: formatPolymarketTaggedEvents(polymarketPicks.taggedEvents),
      metaculusEdges: formatMetaculusEdges(polymarketPicks.edges),
      whaleTrades: formatWhaleTrades(polymarketPicks.whaleTrades),
    },
  });
  const aiRoutes = await requestAiRoutes(prompt.system, prompt.user, fallbackMaturity);
  return mergeAndRankRoutes(aiRoutes, polymarketUniverse, marketContext, params, returnPct, fallbackMaturity);
}

// AI generation now only SUPPLEMENTS Polymarket routes — the deterministic builders
// (treasury / ETF / playbook) and the live Polymarket universe cover a full result set on
// their own. So every failure here is non-fatal: log and return [], and let the merge
// proceed. An empty or thin Polymarket feed must never blow up the whole search.
async function requestAiRoutes(systemPrompt: string, userPrompt: string, fallbackMaturity: number): Promise<Route[]> {
  if (!API_KEY) {
    console.warn('[routes:ai] missing EXPO_PUBLIC_OPENAI_API_KEY — skipping AI Polymarket enrichment');
    return [];
  }
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 5_000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    if (!response.ok) {
      console.warn(`[routes:ai] OpenAI error ${response.status}: ${await response.text()}`);
      return [];
    }
    const payload = await responseJson(response);
    const content = readAssistantContent(payload);
    const parsed = parseJson(extractJson(content));
    const values = Array.isArray(parsed) ? parsed : isRecord(parsed) && Array.isArray(parsed.routes) ? parsed.routes : [];
    const routes = values.filter(isRoute).map((route) => ({
      ...route,
      maturesInDays: route.maturesInDays && route.maturesInDays > 0 ? Math.round(route.maturesInDays) : fallbackMaturity,
    }));
    if (routes.length === 0) console.warn('[routes:ai] no valid Polymarket routes parsed — using deterministic + live routes only');
    return routes;
  } catch (error) {
    console.warn(`[routes:ai] ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
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
  const etfRoutes = buildEtfRoutes({ quotes: market.stocks, balance, target, deadlineDays: fallbackMaturity });
  const cryptoRoutes = buildCryptoRoutes({ quotes: market.stocks, balance, target, deadlineDays: fallbackMaturity });
  const baselines = treasuryRoutes.length > 0 ? baselineRoutes.filter((route) => !isDebtRoute(route)) : baselineRoutes;
  // The AI is scoped to Polymarket; hard-guard it so a stray stock/treasury route can't slip in
  // and collide with the deterministic builders that own those categories.
  const polymarketAiRoutes = aiRoutes.filter((route) => /polymarket/i.test(route.category));
  const sourced = applySourcedDebtFacts([...treasuryRoutes, ...etfRoutes, ...cryptoRoutes, ...baselines, ...polymarketAiRoutes], market.stocks, balance, fallbackMaturity, target);
  const tailored = filterRoutesForQuiz(enforceRouteIntegrity(sourced, target), params);
  const livePolymarket = enforceRouteIntegrity(buildPolymarketRoutes(polymarketUniverse, params), target);
  const unique = [...new Map([...tailored, ...livePolymarket].map((route) => [route.id, route])).values()];
  return sortByPolyProfitScore(unique, (route) => ({
    target,
    requiredInvestment: stakeNeededForReturn(route, balance, target),
    availableInvestment: balance,
    deadlineDays: fallbackMaturity,
  }));
}

function formatRawPicks(picks: RawPick[]): string {
  if (picks.length === 0) return 'No picks fetched; use market data only.';
  const qualityRank = { high: 0, medium: 1, low: 2 } as const;
  return [...picks]
    .sort((a, b) => qualityRank[a.sourceQuality] - qualityRank[b.sourceQuality])
    .slice(0, 40)
    .map((pick, index) => `[${index + 1}] (${pick.category}) ${pick.pick}\nReasoning: ${pick.reasoning}\nSource: ${pick.source} [${pick.sourceQuality}]`)
    .join('\n\n');
}

function extractJson(text: string): string {
  return text.match(/<routes>([\s\S]*?)<\/routes>/)?.[1]?.trim()
    ?? text.match(/```json\n?([\s\S]*?)```/)?.[1]?.trim()
    ?? text.slice(Math.max(0, text.indexOf('[')), text.lastIndexOf(']') + 1);
}

function readAssistantContent(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.choices)) return '';
  const choice = value.choices[0];
  return isRecord(choice) && isRecord(choice.message) && typeof choice.message.content === 'string' ? choice.message.content : '';
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
