import { authenticatedUserId } from '@/lib/server-auth';

/**
 * The shape every endpoint shares: check the session, run the handler, and turn
 * anything thrown into a JSON error instead of a bare 500 with no body.
 */

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

type AuthedHandler = (request: Request, userId: string) => Promise<Response>;

/** Wraps a handler so it only runs for a signed-in user. */
export function withAuth(tag: string, handler: AuthedHandler): (request: Request) => Promise<Response> {
  return async (request) => {
    const userId = await authenticatedUserId(request);
    if (!userId) return jsonError(401, 'Unauthorized');
    try {
      return await handler(request, userId);
    } catch (error) {
      if (error instanceof HttpError) return jsonError(error.status, error.message);
      console.warn(`[api:${tag}] ${error instanceof Error ? error.message : String(error)}`);
      return jsonError(500, 'Something went wrong');
    }
  };
}

/** The request body as JSON, or a 400 when it isn't. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, 'Body must be JSON');
  }
}
