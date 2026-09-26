import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { Brand, OnBrand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface GoalSummary {
  target: number;
  when: string;
  /** Name of the savings goal these routes serve. Null for a search with no goal attached. */
  label: string | null;
  emoji: string | null;
}

interface RoutesHeaderProps {
  goal: GoalSummary;
  historical: boolean;
  batchLabel: string | null;
  routeCount: number;
  onNewSearch: () => void;
  onBackToLatest: () => void;
}

/**
 * What this search is for — kept to just that one question now that "how much are
 * you willing to invest" lives in the Filters panel. Pinned above the scrolling
 * list (see the `stickyHeaderIndices` on the routes screen) so the goal it's
 * ranking against is never scrolled out of view.
 */
export function RoutesHeader({
  goal,
  historical,
  batchLabel,
  routeCount,
  onNewSearch,
  onBackToLatest,
}: RoutesHeaderProps): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={{ borderRadius: Radius.xl, backgroundColor: theme.backgroundElevated, borderWidth: 1, borderColor: theme.border, padding: 14, gap: 6, ...Shadow.card }}>
      <View className="flex-row justify-between items-center" style={{ gap: 10 }}>
        <View className="flex-row items-center flex-1" style={{ gap: 6 }}>
          {goal.emoji ? <Icon glyph={goal.emoji} size={15} color={theme.textSecondary} /> : null}
          <ThemedText numberOfLines={1} style={{ flex: 1, fontSize: 11, fontWeight: '700', color: Brand[500], letterSpacing: 0.8 }}>
            {(historical ? 'SAVED SEARCH' : 'YOUR ROUTES') + (goal.label ? ` · ${goal.label.toUpperCase()}` : '')}
          </ThemedText>
        </View>
        {!historical && (
          <Pressable
            onPress={onNewSearch}
            accessibilityRole="button"
            accessibilityLabel="Start a new goal"
            hitSlop={6}
            className="active:opacity-75"
            style={{ borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Brand[500] }}>
            <ThemedText style={{ fontSize: 13, fontWeight: '900', color: OnBrand }}>+ New goal</ThemedText>
          </Pressable>
        )}
      </View>

      <View className="flex-row items-baseline justify-between">
        <View className="flex-row items-baseline gap-1.5">
          <ThemedText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontSize: 24, fontWeight: '800', color: theme.text, letterSpacing: -0.6, fontVariant: ['tabular-nums'] }}>
            Make +${goal.target.toLocaleString()}
          </ThemedText>
          <ThemedText style={{ fontSize: 12, color: theme.textTertiary }}>{goal.when}</ThemedText>
        </View>
        <ThemedText style={{ fontSize: 12, color: theme.textTertiary }}>
          <ThemedText style={{ fontSize: 12, fontWeight: '800', color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>{routeCount}</ThemedText>
          {' '}route{routeCount === 1 ? '' : 's'}
        </ThemedText>
      </View>

      {batchLabel && <ThemedText style={{ fontSize: 12, color: theme.textTertiary }}>{batchLabel}</ThemedText>}
      {historical && (
        <Pressable onPress={onBackToLatest} className="self-start active:opacity-70">
          <ThemedText style={{ fontSize: 13, fontWeight: '700', color: Brand[500] }}>← Back to latest search</ThemedText>
        </Pressable>
      )}
    </View>
  );
}
