import { withAuth } from '@/server/http';
import { refreshSlate } from '@/server/routes/ai-slate';

export const GET = withAuth('ai-routes', async (request) => {
  const slate = await refreshSlate(new URL(request.url).origin);
  return Response.json({
    routes: slate.routes,
    ...(slate.generatedAt ? { generatedAt: slate.generatedAt } : null),
    ...(slate.stale && slate.generatedAt ? { stale: true } : null),
  });
});
