import { useEffect, useMemo, useState } from 'react';
import { Animated } from 'react-native';

import type { Route } from '@/types/routes';

export function useNearMissToast(routes: Route[]) {
  const route = useMemo(
    () => routes.filter((candidate) => !candidate.meetsTarget).sort((a, b) => b.probability - a.probability)[0] ?? null,
    [routes]
  );
  const [opacity] = useState(() => new Animated.Value(0));

  const dismiss = () => {
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  };

  useEffect(() => {
    if (!route) return;
    opacity.setValue(0);
    const animation = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(5_000),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [opacity, route]);

  return { route, visible: route !== null, opacity, dismiss };
}
