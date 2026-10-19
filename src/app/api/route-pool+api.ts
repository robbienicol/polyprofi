import { goalFromQuery } from '@/server/goal';
import { HttpError, withAuth } from '@/server/http';
import { cachedRoutePool } from '@/server/routes/route-pool';

/**
 * Every route for a goal, built on the server from shared market data. The device
 * applies the user's own filters and sizing; see @/lib/route-pool.
 */
export const GET = withAuth('route-pool', async (request) => {
  const pool = await cachedRoutePool(goalFromQuery(new URL(request.url)));
  if (!pool) throw new HttpError(503, 'Market data is unavailable right now');
  return Response.json({
    routes: pool.value.routes,
    fetchedAt: pool.fetchedAt,
    ...(pool.stale ? { stale: true } : null),
  });
});
