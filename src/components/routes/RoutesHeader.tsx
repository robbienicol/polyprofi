import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { Brand, OnBrand, Radius } from '@/constants/theme';
import { useSemanticText, useTheme } from '@/hooks/use-theme';

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
 * What this search is for, in one line: no card, so the list starts as high as it
 * can. Pinned above the ScrollView rather than inside it, so the goal it is ranking
 * against is never scrolled out of view.
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
  const semantic = useSemanticText();
  const eyebrow = historical ? 'SAVED SEARCH' : goal.label ? goal.label.toUpperCase() : null;
  return (
    <View style={{ gap: 2 }}>
      {eyebrow ? (
        <View className="flex-row items-center" style={{ gap: 6 }}>
          {goal.emoji ? <Icon glyph={goal.emoji} size={13} color={semantic.brand} /> : null}
          <ThemedText numberOfLines={1} style={{ flex: 1, fontSize: 11, fontWeight: '800', color: semantic.brand, letterSpacing: 0.8 }}>
            {eyebrow}
          </ThemedText>
        </View>
      ) : null}

      <View className="flex-row items-center justify-between" style={{ gap: 10 }}>
        <View className="flex-row items-baseline flex-1 flex-wrap" style={{ columnGap: 6 }}>
          {/* No adjustsFontSizeToFit: at an accessibility text size it shrank the one
              figure the screen exists for, so asking for bigger text made it smaller. */}
          <ThemedText style={{ fontSize: 22, fontWeight: '800', color: theme.text, letterSpacing: -0.6, fontVariant: ['tabular-nums'] }}>
            Make +${goal.target.toLocaleString()}
          </ThemedText>
          <ThemedText style={{ fontSize: 13, color: theme.textSecondary }}>
            {goal.when} ·{' '}
            <ThemedText style={{ fontSize: 13, fontWeight: '800', color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>{routeCount}</ThemedText>
            {' '}route{routeCount === 1 ? '' : 's'}
          </ThemedText>
        </View>
        {!historical && (
          <Pressable
            onPress={onNewSearch}
            accessibilityRole="button"
            accessibilityLabel="New search"
            accessibilityHint="Leaves this list and opens the search form"
            hitSlop={8}
            className="flex-row items-center active:opacity-70"
            style={{ gap: 4, borderRadius: Radius.pill, paddingHorizontal: 12, minHeight: 32, backgroundColor: Brand[500] }}>
            <Icon glyph="✏️" size={13} color={OnBrand} />
            <ThemedText style={{ fontSize: 13, fontWeight: '800', color: OnBrand }}>Edit</ThemedText>
          </Pressable>
        )}
      </View>

      {batchLabel && <ThemedText style={{ fontSize: 12, color: theme.textSecondary }}>{batchLabel}</ThemedText>}
      {historical && (
        <Pressable
          onPress={onBackToLatest}
          accessibilityRole="button"
          className="self-start active:opacity-70 justify-center"
          style={{ minHeight: 44, paddingRight: 12 }}>
          <ThemedText style={{ fontSize: 14, fontWeight: '700', color: semantic.brand }}>← Back to latest search</ThemedText>
        </Pressable>
      )}
    </View>
  );
}
