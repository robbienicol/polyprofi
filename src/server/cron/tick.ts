import { runAlertBatch } from '@/server/alerts/run';
import { jsonError } from '@/server/shared/http';
import { cachedOptionChains } from '@/server/market/option-chains';
import { cachedMarketSnapshot } from '@/server/market/snapshot';
import { refreshSlate } from '@/server/routes/ai-slate';

/**
 * The scheduled heartbeat (every ~10 minutes, from .github/workflows/cron.yml):
 * keeps the shared market data and option chains warm so no user's search pays
 * for a cold fetch, regenerates the daily AI slate when it's due, and sends due alerts.
 *
 * Guarded by CRON_SECRET rather than a user session — only the scheduler calls it.
 */
export async function tick(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return jsonError(401, 'Unauthorized');

  const started = Date.now();
  const [snapshot, chains, slate, alerts] = await Promise.allSettled([
    cachedMarketSnapshot(),
    cachedOptionChains(),
    refreshSlate(new URL(request.url).origin),
    runAlertBatch(),
  ]);
  const outcome = (result: PromiseSettledResult<unknown>) => (result.status === 'fulfilled' ? 'ok' : String(result.reason));
  return Response.json({
    snapshot: outcome(snapshot),
    chains: chains.status === 'fulfilled' ? { count: chains.value?.value.chains.length ?? 0, stale: chains.value?.stale ?? true } : outcome(chains),
    slate: slate.status === 'fulfilled' ? { routes: slate.value.routes.length, stale: slate.value.stale } : outcome(slate),
    alerts: alerts.status === 'fulfilled' ? alerts.value : outcome(alerts),
    ms: Date.now() - started,
  });
}
