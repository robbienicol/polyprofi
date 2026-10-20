import { SlidersHorizontal } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Haptic } from '@/lib/haptics';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius } from '@/constants/theme';
import { useSemanticText, useTheme } from '@/hooks/use-theme';
import type { RouteSort } from '@/lib/route-results';

const SORT_OPTIONS: { label: string; value: RouteSort }[] = [
  // "Default order" named nothing, so the top card could not be trusted as the top
  // card. This says what the ranking is actually ordered by.
  { label: 'Best odds', value: 'score' },
  { label: 'Biggest return', value: 'payout' },
  { label: 'Best value', value: 'value' },
  // Ties (no payout date) sort last, so a fund with no maturity never claims "soonest".
  { label: 'Pays out soonest', value: 'soonest' },
];

/**
 * Sort lives outside the Filters panel: it is the one control people reach for on
 * every search, so it sits on the list itself as a single compact row, with the
 * Filters button at its end.
 */
export function SortBar({
  sort,
  onSortChange,
  filterCount,
  filtersOpen,
  onToggleFilters,
}: {
  sort: RouteSort;
  onSortChange: (sort: RouteSort) => void;
  /** Active filters, shown as a badge on the button. Sort is not one of them. */
  filterCount: number;
  filtersOpen: boolean;
  onToggleFilters: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const semantic = useSemanticText();
  const highlighted = filtersOpen || filterCount > 0;
  return (
    <View className="flex-row items-center" style={{ gap: 8 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
        {SORT_OPTIONS.map(({ label, value }) => {
          const active = sort === value;
          return (
            <Pressable
              key={value}
              onPress={() => { Haptic.select(); onSortChange(value); }}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Sort by ${label}`}
              hitSlop={{ top: 6, bottom: 6 }}
              className="justify-center active:opacity-70"
              style={{
                paddingHorizontal: 12,
                minHeight: 32,
                borderRadius: Radius.pill,
                backgroundColor: active ? theme.text : 'transparent',
              }}>
              <ThemedText style={{ fontSize: 13, fontWeight: active ? '800' : '600', color: active ? theme.background : theme.textSecondary }}>
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
      <Pressable
        onPress={onToggleFilters}
        accessibilityRole="button"
        accessibilityState={{ expanded: filtersOpen }}
        accessibilityLabel={filterCount > 0 ? `Filters, ${filterCount} active` : 'Filters'}
        hitSlop={{ top: 6, bottom: 6 }}
        className="flex-row items-center active:opacity-70"
        style={{
          gap: 6,
          paddingHorizontal: 12,
          minHeight: 32,
          borderRadius: Radius.pill,
          borderWidth: 1,
          borderColor: highlighted ? Brand[500] : theme.borderControl,
          backgroundColor: highlighted ? Brand[500] + '1A' : theme.backgroundElement,
        }}>
        <Icon icon={SlidersHorizontal} size={14} color={highlighted ? semantic.brand : theme.textSecondary} />
        <ThemedText style={{ fontSize: 13, fontWeight: '700', color: highlighted ? semantic.brand : theme.textSecondary }}>
          {filterCount > 0 ? `Filters · ${filterCount}` : 'Filters'}
        </ThemedText>
      </Pressable>
    </View>
  );
}
