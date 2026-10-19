import { withAuth } from '@/server/http';
import { liveQuotes } from '@/server/market/quotes';

/** `?symbols=VOO,BTC-USD` → live quotes for the portfolio. */
export const GET = withAuth('quotes', async (request) => {
  const symbols = (new URL(request.url).searchParams.get('symbols') ?? '').split(',');
  return Response.json({ quotes: await liveQuotes(symbols) });
});
