import { MIN_KEYWORD_LENGTH, NO_RESULTS } from '@/lib/search-routes';
import { goalFromQuery } from '@/server/shared/goal';
import { withAuth } from '@/server/shared/http';
import { searchRoutes } from '@/server/search/search-routes';

/** `?q=messi&balance=&target=&timeframe=` → prediction-market and asset routes for the keyword. */
export const search = withAuth('search', async (request) => {
  const url = new URL(request.url);
  const keyword = (url.searchParams.get('q') ?? '').trim();
  const goal = goalFromQuery(url);
  if (keyword.length < MIN_KEYWORD_LENGTH) return Response.json(NO_RESULTS);
  return Response.json(await searchRoutes(keyword, goal));
});
