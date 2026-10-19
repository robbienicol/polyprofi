import {
  formatMetaculusContext,
  formatPolymarketContext,
  formatPopularPolymarketContext,
} from '@/api/client/market-data';
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
import { readCache, writeCache } from '@/server/cache';
import { cachedMarketSnapshot } from '@/server/market/snapshot';
import type { Route } from '@/types/routes';

/**
 * The AI prediction-market slate, generated once a day and shared by every user.
 *
 * The prompt is built here from public market data, the answer is cached for a day,
 * and nobody's device ever sends a prompt. Personalising it (pricing each contract at
 * the user's amount, filtering by their risk and deadline, ranking) happens when the
 * route pool is built and on the device.
 */
const CACHE_KEY = 'ai-route-slate-v1';
const TTL_MS = 24 * 60 * 60 * 1000;
/**
 * When the last generation failed, wait this long before trying again. Without it a
 * dead model key turned every search into a 5-8 s failed generation before the stale
 * slate was served — for eight days, on every request.
 */
const ATTEMPT_KEY = 'ai-route-slate-attempt';
const RETRY_AFTER_MS = 60 * 60 * 1000;
const OPENAI_MODEL = 'gpt-4o';
const MAX_OUTPUT_TOKENS = 6_000;

export interface Slate {
  routes: Route[];
  generatedAt: string | null;
  stale: boolean;
}

// One generation per server instance at a time: callers arriving while it runs
// wait for that answer rather than each starting their own.
let inflight: Promise<Route[] | null> | null = null;

function isOlderThan(fetchedAt: string, ms: number): boolean {
  return Date.now() - new Date(fetchedAt).getTime() >= ms;
}

/** The stored slate, whatever its age. Never generates — safe on the search path. */
export async function readSlate(): Promise<Route[]> {
  const stored = await readCache<{ routes: Route[] }>(CACHE_KEY).catch(() => null);
  return stored?.value.routes ?? [];
}

/**
 * The slate, regenerated when a day old unless a recent attempt failed. Slow when it
 * generates (5-15 s), so it runs from the scheduled refresh and /api/ai-routes, never
 * inside a search.
 */
export async function refreshSlate(origin: string): Promise<Slate> {
  const [stored, lastAttempt] = await Promise.all([
    readCache<{ routes: Route[] }>(CACHE_KEY).catch(() => null),
    readCache<unknown>(ATTEMPT_KEY).catch(() => null),
  ]);
  if (stored && !isOlderThan(stored.fetchedAt, TTL_MS)) {
    return { routes: stored.value.routes, generatedAt: stored.fetchedAt, stale: false };
  }
  const staleSlate: Slate = stored
    ? { routes: stored.value.routes, generatedAt: stored.fetchedAt, stale: true }
    : { routes: [], generatedAt: null, stale: true };
  if (lastAttempt && !isOlderThan(lastAttempt.fetchedAt, RETRY_AFTER_MS)) return staleSlate;

  inflight ??= generateSlate(origin).finally(() => {
    inflight = null;
  });
  const routes = await inflight;
  // A failed generation serves yesterday's slate rather than nothing; each contract is
  // still priced against live data and anything that has moved on drops out.
  return routes ? { routes, generatedAt: new Date().toISOString(), stale: false } : staleSlate;
}

async function generateSlate(origin: string): Promise<Route[] | null> {
  if (!isAiConfigured()) return null;
  // Claimed before the slow part, so concurrent requests on other instances see it
  // and serve the stale slate instead of each starting their own generation.
  await writeCache(ATTEMPT_KEY, {}).catch(() => undefined);

  const [snapshot, picks] = await Promise.all([cachedMarketSnapshot(), fetchPickBundle(origin)]);
  // Without live prices there is nothing to validate an idea against; don't pay
  // for a slate that would be guesswork, and don't cache one.
  if (!snapshot || snapshot.value.universe.length === 0) return null;
  const { context: marketContext, universe } = snapshot.value;

  const prompt = buildDailySlatePrompt({
    picks: formatRawPicks([...picks.commentPicks, ...whaleTradesToPicks(picks.whaleTrades)]),
    polymarket: formatPolymarketContext(marketContext.polymarket),
    popularPolymarket: formatPopularPolymarketContext(universe.slice(0, 40)),
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

    await writeCache(CACHE_KEY, { routes });
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
