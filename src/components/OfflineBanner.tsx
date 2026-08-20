import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Accent } from '@/constants/theme';
import { useNetworkStatus } from '@/hooks/use-network-status';

/** Thin banner shown app-wide while the device has no connection. */
export function OfflineBanner(): React.ReactElement | null {
  const { isOffline } = useNetworkStatus();
  const insets = useSafeAreaInsets();
  if (!isOffline) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backgroundColor: Accent.red,
        paddingTop: insets.top + 6,
        paddingBottom: 8,
        alignItems: 'center',
      }}>
      <ThemedText style={{ color: '#FFF', fontSize: 12.5, fontWeight: '700' }}>
        You&apos;re offline — showing the last data we had
      </ThemedText>
    </View>
  );
}
