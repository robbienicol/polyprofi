import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { apiRequest, type TokenProvider } from '@/api/client/api-request';
import { KEYS } from '@/api/client/storage-keys';

/**
 * Hands this device's push token to our server, so alerts reach the user while the
 * app is closed. Once the server holds a token, it is the one sending position and
 * goal alerts, and the device's own local copies stand down (see notifyAlert) — the
 * same alert must never arrive twice.
 *
 * Never prompts: it only registers when permission was already granted, by onboarding
 * or the Settings toggles.
 */

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId;
}

export async function registerForPush(getToken: TokenProvider): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return false;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
    const saved = await apiRequest('/api/push-token', { getToken, method: 'POST', body: { token, platform: Platform.OS } });
    if (!saved) return false;
    await AsyncStorage.setItem(KEYS.PUSH_TOKEN, token);
    return true;
  } catch (error) {
    // Simulators and builds without push credentials land here; local alerts carry on.
    console.warn(`[push] registration skipped: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/** Called before signing out, so the next account on this phone doesn't get this one's alerts. */
export async function unregisterPush(getToken: TokenProvider): Promise<void> {
  const token = await AsyncStorage.getItem(KEYS.PUSH_TOKEN).catch(() => null);
  if (!token) return;
  await apiRequest('/api/push-token', { getToken, method: 'POST', body: { token, remove: true } });
  await AsyncStorage.removeItem(KEYS.PUSH_TOKEN).catch(() => undefined);
}

/** True when the server is sending this device's alerts. */
export async function isPushActive(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.PUSH_TOKEN).catch(() => null)) != null;
}
