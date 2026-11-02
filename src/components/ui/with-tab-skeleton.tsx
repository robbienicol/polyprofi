import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bone, ListRowsSkeleton, RoutesScreenSkeleton, Skeleton } from '@/components/ui/loaders';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TabShape = 'home' | 'routes' | 'list' | 'settings';

/** The rough shape of each tab, so the first frame is a layout, not a blank. */
function TabSkeleton({ shape }: { shape: TabShape }): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {shape === 'routes' ? (
          <RoutesScreenSkeleton />
        ) : (
          <Skeleton style={{ gap: 14, padding: 16 }}>
            <Bone width="45%" height={26} />
            {shape === 'home' ? (
              <>
                <Bone width="60%" height={38} />
                <Bone height={190} radius={Radius.lg} />
                <ListRowsSkeleton rows={3} height={72} />
              </>
            ) : shape === 'settings' ? (
              <ListRowsSkeleton rows={5} height={56} />
            ) : (
              <ListRowsSkeleton rows={4} height={88} />
            )}
          </Skeleton>
        )}
      </SafeAreaView>
    </View>
  );
}

/**
 * A tab paints its skeleton on the frame it is tapped and builds the real screen on
 * the next one. A tab mounts on its first visit, and building a whole screen inside
 * the tap is what made switching feel like it stuck before anything changed. Later
 * visits reuse the mounted screen, so this only ever costs the first.
 */
export function withTabSkeleton<P extends object>(Screen: React.ComponentType<P>, shape: TabShape): React.ComponentType<P> {
  function TabWithSkeleton(props: P): React.ReactElement {
    const [ready, setReady] = useState(false);
    useEffect(() => {
      // Two frames: one to put the skeleton on screen, one to start the real build.
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setReady(true));
      });
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }, []);
    return ready ? <Screen {...props} /> : <TabSkeleton shape={shape} />;
  }
  TabWithSkeleton.displayName = `withTabSkeleton(${Screen.displayName ?? Screen.name})`;
  return TabWithSkeleton;
}
