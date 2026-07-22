import { Pressable, View } from 'react-native';

import { riskLabel } from '@/components/molecules/RouteCard';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { routeDisplayTitle } from '@/lib/route-detail';
import type { Route } from '@/types/routes';

const MONO = { fontVariant: ['tabular-nums' as const] };

export function RelatedRoutes({ routes, onSelect }: { routes: Route[]; onSelect: (route: Route) => void }): React.ReactElement | null {
  const theme = useTheme();
  if (routes.length === 0) return null;
  return (
    <View className="gap-2.5">
      <ThemedText style={{ fontSize: 15, fontWeight: '800', color: theme.text }}>Related bets</ThemedText>
      {routes.map((route) => (
        <Pressable key={route.id} onPress={() => onSelect(route)} className="flex-row items-center gap-3 active:opacity-75" style={{ borderRadius: Radius.lg, backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.border, padding: 13 }}>
          <ThemedText style={{ fontSize: 22 }}>{route.emoji}</ThemedText>
          <View className="flex-1"><ThemedText style={{ fontSize: 14, fontWeight: '800', color: theme.text }} numberOfLines={1}>{routeDisplayTitle(route)}</ThemedText><ThemedText style={{ fontSize: 12, lineHeight: 17, color: theme.textSecondary, marginTop: 3 }} numberOfLines={2}>{route.description}</ThemedText><ThemedText style={{ fontSize: 11, color: theme.textTertiary }} numberOfLines={1}>{route.category} · {riskLabel(route.riskLevel)}</ThemedText></View>
          <View className="items-end"><ThemedText style={{ fontSize: 14, fontWeight: '900', color: Brand[500], ...MONO }}>+${route.expectedReturn}</ThemedText><ThemedText style={{ fontSize: 11, color: theme.textSecondary, ...MONO }}>{route.probability}% chance</ThemedText></View>
        </Pressable>
      ))}
    </View>
  );
}
