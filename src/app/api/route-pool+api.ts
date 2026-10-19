import type { PoolGoal } from '@/lib/route-pool';
import { HttpError, withAuth } from '@/server/http';
import { cachedRoutePool } from '@/server/routes/route-pool';

const TIMEFRAMES: readonly PoolGoal['timeframe'][] = ['today', 'week', 'month', '3months', '1year', '5years'];

/** `?balance=&target=&timeframe=` as a goal, or a 400 naming what's wrong. */
function goalFrom(url: URL): PoolGoal {
  const balance = Number(url.searchParams.get('balance'));
  const target = Number(url.searchParams.get('target'));
  const timeframe = url.searchParams.get('timeframe') as PoolGoal['timeframe'];
  if (!(balance > 0) || !(target > 0)) throw new HttpError(400, 'balance and target must be positive numbers');
  if (!TIMEFRAMES.includes(timeframe)) throw new HttpError(400, `timeframe must be one of ${TIMEFRAMES.join(', ')}`);
  return { balance, target, timeframe };
}

/**
 * Every route for a goal, built on the server from shared market data. The device
 * applies the user's own filters and sizing; see @/lib/route-pool.
 */
export const GET = withAuth('route-pool', async (request) => {
  const pool = await cachedRoutePool(goalFrom(new URL(request.url)));
  if (!pool) throw new HttpError(503, 'Market data is unavailable right now');
  return Response.json({
    routes: pool.value.routes,
    fetchedAt: pool.fetchedAt,
    ...(pool.stale ? { stale: true } : null),
  });
});
