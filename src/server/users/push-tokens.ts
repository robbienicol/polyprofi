import { isRecord } from '@/lib/runtime-validation';
import { HttpError, readJson, withAuth } from '@/server/shared/http';
import { removePushToken, savePushToken } from '@/server/users/queries';

/**
 * Registers this device's Expo push token for the signed-in user, or removes it
 * (`remove: true`) on sign-out. A token moving to a new account follows the newest
 * sign-in, so a shared phone never gets the previous owner's alerts.
 */
export const registerPushToken = withAuth('push-token', async (request, userId) => {
  const body = await readJson(request);
  const token = isRecord(body) && typeof body.token === 'string' ? body.token : '';
  if (!/^Expo(nent)?PushToken\[.+\]$/.test(token)) throw new HttpError(400, 'token must be an Expo push token');

  if (isRecord(body) && body.remove === true) {
    await removePushToken(userId, token);
    return Response.json({ removed: true });
  }
  const platform = isRecord(body) && typeof body.platform === 'string' ? body.platform.slice(0, 16) : 'unknown';
  await savePushToken(userId, token, platform);
  return Response.json({ registered: true });
});
