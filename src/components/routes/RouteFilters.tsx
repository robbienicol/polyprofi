import Slider from '@react-native-community/slider';
import { Pressable, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Accent, Brand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { RouteFilters as Filters, RouteSort } from '@/lib/route-results';
import type { Route } from '@/types/routes';

const LOSS_PROFILE_FILTERS: { label: string; value: Route['lossProfile']; color: string }[] = [
  { label: 'All-or-nothing', value: 'binary', color: Accent.red },
  { label: 'Capital safe', value: 'partial', color: Brand[500] },
];

const SORT_OPTIONS: { label: string; value: RouteSort }[] = [
  { label: 'Top score', value: 'score' },
  { label: 'Safest', value: 'safest' },
  { label: 'Best chance', value: 'chance' },
  { label: 'Biggest payout', value: 'payout' },
];

interface RouteFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export function RouteFilters({ filters, onChange }: RouteFiltersProps): React.ReactElement {
  const theme = useTheme();
  const update = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  return (
    <>
      <View style={{ borderRadius: Radius.lg, backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 14, paddingVertical: 10, gap: 2 }}>
        <View className="flex-row justify-between items-center">
          <ThemedText style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary }}>Chance of hitting goal</ThemedText>
          <ThemedText style={{ fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'], color: filters.minimumProbability === 0 ? theme.textTertiary : filters.minimumProbability >= 65 ? Brand[500] : Accent.gold }}>
            {filters.minimumProbability === 0 ? 'Any' : `≥ ${filters.minimumProbability}%`}
          </ThemedText>
        </View>
        <Slider style={{ width: '100%', height: 32 }} minimumValue={0} maximumValue={90} step={5} value={filters.minimumProbability} onValueChange={(value) => update({ minimumProbability: Math.round(value) })} minimumTrackTintColor={Brand[500]} maximumTrackTintColor={theme.backgroundSelected} thumbTintColor={filters.minimumProbability === 0 ? theme.textTertiary : Brand[500]} />
      </View>

      <FilterRow>
        {LOSS_PROFILE_FILTERS.map(({ label, value, color }) => (
          <FilterChip key={value} label={label} active={filters.lossProfile === value} activeColor={color} onPress={() => update({ lossProfile: filters.lossProfile === value ? null : value })} />
        ))}
        <View style={{ width: 1, alignSelf: 'stretch', marginVertical: 4, marginHorizontal: 2, backgroundColor: theme.border }} />
        {SORT_OPTIONS.map(({ label, value }) => (
          <FilterChip key={value} label={label} active={filters.sort === value} onPress={() => update({ sort: value })} />
        ))}
      </FilterRow>
    </>
  );
}

function FilterRow({ label, children }: React.PropsWithChildren<{ label?: string }>): React.ReactElement {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {label && <ThemedText style={{ fontSize: 12, color: theme.textTertiary, fontWeight: '700', alignSelf: 'center', marginRight: 2 }}>{label}</ThemedText>}
      {children}
    </ScrollView>
  );
}

function FilterChip({ label, active, activeColor = Brand[500], onPress }: { label: string; active: boolean; activeColor?: string; onPress: () => void }): React.ReactElement {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1, borderColor: active ? activeColor : theme.border, backgroundColor: active ? activeColor + '1A' : theme.backgroundElement }}>
      <ThemedText style={{ fontSize: 13, fontWeight: active ? '800' : '600', color: active ? activeColor : theme.textSecondary }}>{label}</ThemedText>
    </Pressable>
  );
}
