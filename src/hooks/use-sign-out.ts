import { useAuth } from '@clerk/clerk-expo';

import { unregisterPush } from '@/api/client/push-registration';

/**
 * Signs out, first telling the server to stop sending this account's alerts to this
 * phone — otherwise the next person to sign in here would get them.
 */
export function useSignOut(): () => Promise<void> {
  const { signOut, getToken } = useAuth();
  return async () => {
    await unregisterPush(getToken).catch(() => undefined);
    await signOut();
  };
}
