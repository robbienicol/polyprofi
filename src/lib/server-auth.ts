import { verifyToken } from '@clerk/backend';

export async function authenticatedUserId(request: Request): Promise<string | null> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!secretKey || !token) return null;

  try {
    const payload = await verifyToken(token, { secretKey });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
