import { fetchAllBetStatuses } from '@/api/client/bet-monitor';
import { isArrayOf, isRecord, isTrackedBet } from '@/lib/runtime-validation';
import { liveQuotes } from '@/server/market/quotes';
import { HttpError, readJson, withAuth } from '@/server/shared/http';

const MAX_POSITIONS = 200;

/**
 * Live status for the positions in the body: price, P&L, score, whether to sell. One
 * request where the device made a Polymarket lookup per chunk, a search per unlinked
 * position and six scoreboard calls, every minute.
 */
export const livePositionStatuses = withAuth('positions-live', async (request) => {
  const body = await readJson(request);
  const bets = isRecord(body) ? body.bets : null;
  if (!isArrayOf(isTrackedBet)(bets)) throw new HttpError(400, 'bets must be an array of tracked positions');
  if (bets.length > MAX_POSITIONS) throw new HttpError(400, `at most ${MAX_POSITIONS} positions per request`);
  return Response.json({ statuses: await fetchAllBetStatuses(bets) });
});

/** `?symbols=VOO,BTC-USD` → live quotes for the portfolio. */
export const getQuotes = withAuth('quotes', async (request) => {
  const symbols = (new URL(request.url).searchParams.get('symbols') ?? '').split(',');
  return Response.json({ quotes: await liveQuotes(symbols) });
});
