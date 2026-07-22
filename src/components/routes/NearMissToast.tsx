import { Animated, Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Accent, Radius, Shadow } from '@/constants/theme';
import type { Route } from '@/types/routes';

interface NearMissToastProps {
  route: Route;
  opacity: Animated.Value;
  onDismiss: () => void;
}

export function NearMissToast({ route, opacity, onDismiss }: NearMissToastProps): React.ReactElement {
  return (
    <Animated.View style={{ opacity, transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }], position: 'absolute', top: 12, left: 16, right: 16 }} pointerEvents="box-none">
      <View className="flex-row items-center" style={{ borderRadius: Radius.lg, backgroundColor: '#000', borderWidth: 1, borderColor: Accent.gold + '55', paddingVertical: 12, paddingLeft: 14, paddingRight: 8, gap: 11, ...Shadow.float }}>
        <ThemedText style={{ fontSize: 18 }}>{route.emoji}</ThemedText>
        <View className="flex-1">
          <ThemedText style={{ fontSize: 11, fontWeight: '700', color: Accent.gold, letterSpacing: 0.3 }}>CLOSE CALL · JUST UNDER TARGET</ThemedText>
          <ThemedText style={{ fontSize: 13, fontWeight: '600', color: '#fff' }} numberOfLines={1}>{route.category} · +${route.expectedReturn} at {route.probability}%</ThemedText>
        </View>
        <Pressable onPress={onDismiss} hitSlop={10} style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}>
          <ThemedText style={{ fontSize: 18, color: '#888', lineHeight: 20 }}>×</ThemedText>
        </Pressable>
      </View>
    </Animated.View>
  );
}
