import { isRecord } from '@/lib/runtime-validation';
import { sql } from '@/server/db';
import { HttpError, readJson, withAuth } from '@/server/http';

/**
 * Registers this device's Expo push token for the signed-in user, or removes it
 * (`remove: true`) on sign-out. A token moving to a new account follows the newest
 * sign-in, so a shared phone never gets the previous owner's alerts.
 */
export const POST = withAuth('push-token', async (request, userId) => {
  const body = await readJson(request);
  const token = isRecord(body) && typeof body.token === 'string' ? body.token : '';
  if (!/^Expo(nent)?PushToken\[.+\]$/.test(token)) throw new HttpError(400, 'token must be an Expo push token');

  if (isRecord(body) && body.remove === true) {
    await sql`DELETE FROM push_tokens WHERE token = ${token} AND clerk_id = ${userId}`;
    return Response.json({ removed: true });
  }
  const platform = isRecord(body) && typeof body.platform === 'string' ? body.platform.slice(0, 16) : 'unknown';
  await sql`
    INSERT INTO push_tokens (token, clerk_id, platform, updated_at)
    VALUES (${token}, ${userId}, ${platform}, now())
    ON CONFLICT (token) DO UPDATE SET clerk_id = EXCLUDED.clerk_id, platform = EXCLUDED.platform, updated_at = now()
  `;
  return Response.json({ registered: true });
});
