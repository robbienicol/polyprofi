import { neon } from '@neondatabase/serverless';

import {
  fetchMarketContext,
  formatMetaculusContext,
  formatPolymarketContext,
  formatPopularPolymarketContext,
} from '@/api/client/market-data';
import { fetchPolymarketSnapshot } from '@/api/client/polymarket-market-data';
import type { PolymarketPickBundle } from '@/api/client/polymarket-pick-types';
import {
  formatMetaculusEdges,
  formatPolymarketTaggedEvents,
  formatWhaleTrades,
  whaleTradesToPicks,
} from '@/api/client/polymarket-picks';
import { buildDailySlatePrompt, extractRoutesJson, formatRawPicks } from '@/api/client/route-generation-prompt';
import { chatCompletion, isAiConfigured, type ChatResult } from '@/lib/ai-chat';
import { isRecord, isRoute, parseJson, responseJson } from '@/lib/runtime-validation';
import { authenticatedUserId } from '@/lib/server-auth';
import type { Route } from '@/types/routes';

const sql = neon(process.env.NEON_DATABASE_URL!);

/**
 * The AI prediction-market slate, generated once a day and shared by every user.
 *
 * This used to be a pass-through: the device built the whole prompt and posted it
 * here, and this handed it to GPT-4o. That cost one generation per search setting
 * per phone, and it let any signed-in user send any prompt on our key. Now the
 * prompt is built here from public market data, the answer is cached in Neon for a
 * day, and the device only ever GETs the result. Personalising it (pricing each
 * contract at the user's amount, filtering by their risk and deadline, ranking)
 * happens on the device, in @/api/client/anthropic.
 *
 * Reuses the polymarket_pick_cache table (key → JSONB, fetched_at) under its own key.
 */
const CACHE_KEY = 'ai-route-slate-v1';
const TTL_MS = 24 * 60 * 60 * 1000;
const OPENAI_MODEL = 'gpt-4o';
const MAX_OUTPUT_TOKENS = 6_000;

interface CacheRow {
  bundle: { routes: Route[] };
  fetched_at: string;
}

// One generation per server instance at a time: requests arriving while it runs
// wait for that answer rather than each starting their own.
let inflight: Promise<Route[] | null> | null = null;

export async function GET(request: Request): Promise<Response> {
  const userId = await authenticatedUserId(request);
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = (await sql`
    SELECT bundle, fetched_at FROM polymarket_pick_cache WHERE key = ${CACHE_KEY}
  `) as CacheRow[];
  const cached = rows[0];
  const fresh = cached != null && Date.now() - new Date(cached.fetched_at).getTime() < TTL_MS;
  if (fresh) return Response.json({ routes: cached.bundle.routes, generatedAt: cached.fetched_at });

  inflight ??= generateSlate(new URL(request.url).origin).finally(() => {
    inflight = null;
  });
  const routes = await inflight;
  if (routes) return Response.json({ routes, generatedAt: new Date().toISOString() });
  // A failed generation serves yesterday's slate rather than nothing; the device
  // still prices it against live data and drops anything that has moved on.
  if (cached) return Response.json({ routes: cached.bundle.routes, generatedAt: cached.fetched_at, stale: true });
  return Response.json({ routes: [] });
}

async function generateSlate(origin: string): Promise<Route[] | null> {
  if (!isAiConfigured()) return null;

  const snapshot = await fetchPolymarketSnapshot().catch(() => ({ context: [], universe: [] }));
  // Without live prices there is nothing to validate an idea against; don't pay
  // for a slate that would be guesswork, and don't cache one.
  if (snapshot.universe.length === 0) return null;

  const [marketContext, picks] = await Promise.all([
    fetchMarketContext({ polymarket: Promise.resolve(snapshot.context) }),
    fetchPickBundle(origin),
  ]);

  const prompt = buildDailySlatePrompt({
    picks: formatRawPicks([...picks.commentPicks, ...whaleTradesToPicks(picks.whaleTrades)]),
    polymarket: formatPolymarketContext(marketContext.polymarket),
    popularPolymarket: formatPopularPolymarketContext(snapshot.universe.slice(0, 40)),
    metaculus: formatMetaculusContext(marketContext.metaculus),
    taggedPolymarket: formatPolymarketTaggedEvents(picks.taggedEvents),
    metaculusEdges: formatMetaculusEdges(picks.edges),
    whaleTrades: formatWhaleTrades(picks.whaleTrades),
  });

  try {
    const result = await chatCompletion({
      tag: 'api:ai-routes',
      openAiModel: OPENAI_MODEL,
      maxTokens: MAX_OUTPUT_TOKENS,
      accept: (content) => parseSlate(content).length > 0,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
    });
    if (!result) return null;
    logUsage(result);
    const routes = parseSlate(result.content);
    if (routes.length === 0) return null;

    await sql`
      INSERT INTO polymarket_pick_cache (key, bundle, fetched_at)
      VALUES (${CACHE_KEY}, ${JSON.stringify({ routes })}::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET bundle = EXCLUDED.bundle, fetched_at = EXCLUDED.fetched_at
    `;
    return routes;
  } catch (error) {
    console.warn(`[api:ai-routes] ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/** The model's answer as valid Polymarket routes; empty when unusable. */
function parseSlate(content: string): Route[] {
  const parsed = parseJson(extractRoutesJson(content));
  const values: unknown[] = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.routes) ? parsed.routes : [];
  // The slate carries no money: the device prices every route at the user's own
  // amount. Placeholders here keep the shared Route shape valid.
  return values
    .map((value) => (isRecord(value) ? { ...value, expectedReturn: 0, meetsTarget: false } : value))
    .filter(isRoute)
    .filter((route) => /polymarket/i.test(route.category) && Boolean(route.line))
    .map((route, index) => ({ ...route, id: `ai-${route.id || index}` }));
}

/** The shared, already-cached crawl behind /api/polymarket-picks. */
async function fetchPickBundle(origin: string): Promise<PolymarketPickBundle> {
  const empty: PolymarketPickBundle = { taggedEvents: [], commentPicks: [], edges: [], whaleTrades: [] };
  try {
    const response = await fetch(`${origin}/api/polymarket-picks`);
    if (!response.ok) return empty;
    const payload = await responseJson(response);
    return isRecord(payload) ? { ...empty, ...(payload as Partial<PolymarketPickBundle>) } : empty;
  } catch {
    return empty;
  }
}

/** One line per generation, so real token spend shows up in the server logs. */
function logUsage(result: ChatResult): void {
  if (!result.usage) return;
  console.log(`[api:ai-routes] ${result.provider}/${result.model} slate: ${result.usage.promptTokens} in / ${result.usage.completionTokens} out`);
}
