import { Route } from '@/types/routes';
import { apiBaseUrl } from '@/lib/api-base-url';
import { isRecord } from '@/lib/runtime-validation';

export async function fetchRouteCoachReply(
  route: Route,
  question: string,
  getToken: () => Promise<string | null>,
): Promise<string> {
  const fallback = `This route ranks well because it combines a ${route.probability}% hit chance with a $${route.expectedReturn} upside. Main watch-out: ${route.lossProfile === 'binary' ? 'it can lose the full stake if wrong' : 'the capital is less binary, but timing still matters'}.`;
  const token = await getToken();
  if (!token) return fallback;
  const res = await fetch(`${apiBaseUrl()}/api/ai-coach`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ route, question }),
  });

  if (!res.ok) return fallback;
  const payload = await res.json() as unknown;
  return isRecord(payload) && typeof payload.reply === 'string' ? payload.reply.trim() || fallback : fallback;
}
