import { goalFromQuery } from '@/server/shared/goal';
import { HttpError, withAuth } from '@/server/shared/http';
import { refreshSlate } from '@/server/routes/ai-slate';
import { cachedRoutePool } from '@/server/routes/route-pool';

/**
 * Every route for a goal, built on the server from shared market data. The device
 * applies the user's own filters and sizing; see @/lib/route-pool.
 */
export const getRoutePool = withAuth('route-pool', async (request) => {
  const pool = await cachedRoutePool(goalFromQuery(new URL(request.url)));
  if (!pool) throw new HttpError(503, 'Market data is unavailable right now');
  return Response.json({
    routes: pool.value.routes,
    fetchedAt: pool.fetchedAt,
    ...(pool.stale ? { stale: true } : null),
  });
});

export const getAiRoutes = withAuth('ai-routes', async (request) => {
  const slate = await refreshSlate(new URL(request.url).origin);
  return Response.json({
    routes: slate.routes,
    ...(slate.generatedAt ? { generatedAt: slate.generatedAt } : null),
    ...(slate.stale && slate.generatedAt ? { stale: true } : null),
  });
});
