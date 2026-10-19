import { fetchAllBetStatuses } from '@/api/client/bet-monitor';
import { isArrayOf, isRecord, isTrackedBet } from '@/lib/runtime-validation';
import { HttpError, readJson, withAuth } from '@/server/http';

const MAX_POSITIONS = 200;

/**
 * Live status for the positions in the body: price, P&L, score, whether to sell. One
 * request where the device made a Polymarket lookup per chunk, a search per unlinked
 * position and six scoreboard calls, every minute.
 */
export const POST = withAuth('positions-live', async (request) => {
  const body = await readJson(request);
  const bets = isRecord(body) ? body.bets : null;
  if (!isArrayOf(isTrackedBet)(bets)) throw new HttpError(400, 'bets must be an array of tracked positions');
  if (bets.length > MAX_POSITIONS) throw new HttpError(400, `at most ${MAX_POSITIONS} positions per request`);
  return Response.json({ statuses: await fetchAllBetStatuses(bets) });
});
