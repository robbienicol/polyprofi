import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useSemanticText, useTheme } from '@/hooks/use-theme';
import type { Route } from '@/types/routes';

/**
 * Header for a probability band. Reports the range actually present in the group
 * rather than the band's nominal bounds — "58-64%" is true of these routes, where
 * "35-64%" would only be true of the band.
 */
export function ChanceGroupHeader({ label, routes }: { label: string; routes: Route[] }): React.ReactElement {
  const theme = useTheme();
  const semantic = useSemanticText();
  const chances = routes.map((route) => route.probability);
  const low = Math.min(...chances);
  const high = Math.max(...chances);
  const range = low === high ? `${low}%` : `${low}-${high}%`;

  return (
    <View className="flex-row items-center" style={{ gap: 8, paddingHorizontal: 4, paddingTop: 4 }}>
      <ThemedText style={{ fontSize: 11, fontWeight: '900', color: semantic.brand, letterSpacing: 0.9 }}>
        {label.toUpperCase()}
      </ThemedText>
      <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>
        {range}
      </ThemedText>
      <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
      <ThemedText style={{ fontSize: 11, color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>
        {routes.length} route{routes.length === 1 ? '' : 's'}
      </ThemedText>
    </View>
  );
}
