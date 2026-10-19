import type { PoolGoal } from '@/lib/route-pool';
import { HttpError } from '@/server/shared/http';

const TIMEFRAMES: readonly PoolGoal['timeframe'][] = ['today', 'week', 'month', '3months', '1year', '5years'];

/** `?balance=&target=&timeframe=` as a goal, or a 400 naming what's wrong. */
export function goalFromQuery(url: URL): PoolGoal {
  const balance = Number(url.searchParams.get('balance'));
  const target = Number(url.searchParams.get('target'));
  const timeframe = url.searchParams.get('timeframe') as PoolGoal['timeframe'];
  if (!(balance > 0) || !(target > 0)) throw new HttpError(400, 'balance and target must be positive numbers');
  if (!TIMEFRAMES.includes(timeframe)) throw new HttpError(400, `timeframe must be one of ${TIMEFRAMES.join(', ')}`);
  return { balance, target, timeframe };
}
