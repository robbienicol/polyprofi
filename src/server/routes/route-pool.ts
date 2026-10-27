import { buildRoutePool, routePoolKey, type PoolGoal } from '@/lib/route-pool';
import { cached } from '@/server/shared/cache';
import { cachedMarketSnapshot } from '@/server/market/snapshot';
import { cachedOptionChains } from '@/server/market/option-chains';
import { readSlate } from '@/server/routes/ai-slate';
import type { Route } from '@/types/routes';

/**
 * The route pool for a goal, built once per deadline and return band and shared by
 * everyone whose goal lands in it. Same freshness as the market data underneath.
 */
const TTL_MS = 10 * 60 * 1000;

async function buildPool(goal: PoolGoal): Promise<{ routes: Route[] }> {
  const [snapshot, chains, aiSlate] = await Promise.all([
    cachedMarketSnapshot(),
    cachedOptionChains(),
    readSlate(),
  ]);
  if (!snapshot) throw new Error('no market data');
  const routes = buildRoutePool({
    market: snapshot.value.context,
    universe: snapshot.value.universe,
    optionChains: chains?.value.chains ?? [],
    aiSlate,
  }, goal);
  return { routes };
}

export function cachedRoutePool(goal: PoolGoal) {
  return cached(routePoolKey(goal), () => buildPool(goal), {
    ttlMs: TTL_MS,
    isEmpty: (pool) => pool.routes.length === 0,
  });
}
