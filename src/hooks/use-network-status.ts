import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/**
 * True when the device has no usable network connection. Starts `false`
 * (assume online) until NetInfo reports in, to avoid an offline-banner flash
 * on cold launch.
 */
export function useNetworkStatus(): { isOffline: boolean } {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // isInternetReachable can be `null` while NetInfo is still figuring it
      // out — only treat it as offline once we have a definite `false`.
      const reachable = state.isInternetReachable;
      setIsOffline(state.isConnected === false || reachable === false);
    });
    return unsubscribe;
  }, []);

  return { isOffline };
}
