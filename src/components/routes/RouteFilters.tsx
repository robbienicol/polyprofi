import Slider from '@react-native-community/slider';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Accent, Brand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isPredictionCategory, PREDICTION_TOPICS } from '@/lib/prediction-topics';
import type { RouteFilters as Filters, RouteSort } from '@/lib/route-results';
import type { Route } from '@/types/routes';

const LOSS_PROFILE_FILTERS: { label: string; value: Route['lossProfile']; color: string }[] = [
  { label: 'All-or-nothing', value: 'binary', color: Accent.red },
  { label: 'Capital preservation', value: 'partial', color: Brand[500] },
];

const ASSET_CLASS_ORDER = ['Polymarket', 'Savings & Treasuries', 'Stocks & ETFs', 'Crypto'];

const RESOLUTION_WINDOWS: readonly { label: string; days: number }[] = [
  { label: 'Days', days: 7 },
  { label: 'Weeks', days: 30 },
  { label: 'Months', days: 120 },
];

const SORT_OPTIONS: { label: string; value: RouteSort }[] = [
  { label: 'Default order', value: 'score' },
  { label: 'Best chance', value: 'chance' },
  { label: 'Biggest payout', value: 'payout' },
];

interface RouteFiltersProps {
  filters: Filters;
  categories: string[];
  onChange: (filters: Filters) => void;
  /** True while a keyword search is in flight, so the field can say so. */
  isSearching?: boolean;
  /** How many markets the keyword pulled in from outside this goal's pool. */
  searchResultCount?: number;
}

export function RouteFilters({
  filters,
  categories,
  onChange,
  isSearching = false,
  searchResultCount = 0,
}: RouteFiltersProps): React.ReactElement {
  const theme = useTheme();
  const update = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const assetClasses = [...new Set(categories)].sort(compareAssetClasses);
  // The asset-class chip is the intent signal: selecting prediction markets is how a
  // user asks to go deep, so that is what reveals the facets.
  const showPredictionFacets = isPredictionCategory(filters.category);
  const anyPredictionFacetActive = filters.predictionTopic != null
    || filters.maxDaysToResolve != null
    || filters.groupByChance
    || filters.keyword.trim().length > 0;
  const searchStatus = !filters.keyword.trim()
    ? null
    : isSearching
      ? 'Searching all of Polymarket…'
      : searchResultCount > 0
        ? `${searchResultCount} market${searchResultCount === 1 ? '' : 's'} pulled in from Polymarket`
        : 'No extra markets found — showing matches from this search only';

  return (
    <>
      <FilterRow label="Asset class">
        <FilterChip label="All" active={filters.category === null} onPress={() => update({ category: null })} />
        {assetClasses.map((category) => (
          <FilterChip
            key={category}
            label={assetClassLabel(category)}
            active={filters.category === category}
            onPress={() => update({ category })}
          />
        ))}
      </FilterRow>

      <View style={{ borderRadius: Radius.lg, backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 14, paddingVertical: 10, gap: 2 }}>
        <View className="flex-row justify-between items-center">
          <ThemedText style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary }}>Chance of hitting goal</ThemedText>
          <ThemedText style={{ fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'], color: filters.minimumProbability === 0 ? theme.textTertiary : filters.minimumProbability >= 65 ? Brand[500] : Accent.gold }}>
            {filters.minimumProbability === 0 ? 'Any' : `≥ ${filters.minimumProbability}%`}
          </ThemedText>
        </View>
        <Slider style={{ width: '100%', height: 32 }} minimumValue={0} maximumValue={90} step={5} value={filters.minimumProbability} onValueChange={(value) => update({ minimumProbability: Math.round(value) })} minimumTrackTintColor={Brand[500]} maximumTrackTintColor={theme.backgroundSelected} thumbTintColor={filters.minimumProbability === 0 ? theme.textTertiary : Brand[500]} />
      </View>

      {/* Prediction-market depth, shown only once the user has asked for prediction
          markets. Every facet here is meaningless for a T-bill or an index fund, so
          the aggregate list never carries them. */}
      {showPredictionFacets ? (
        <View style={{ borderRadius: Radius.lg, backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: Brand[500] + '3D', paddingHorizontal: 14, paddingVertical: 12, gap: 12 }}>
          <View className="flex-row items-center justify-between" style={{ gap: 10 }}>
            <ThemedText style={{ fontSize: 11, fontWeight: '900', color: Brand[500], letterSpacing: 0.8 }}>
              PREDICTION MARKETS
            </ThemedText>
            {anyPredictionFacetActive ? (
              <Pressable
                onPress={() => update({ predictionTopic: null, maxDaysToResolve: null, groupByChance: false, keyword: '' })}
                accessibilityRole="button"
                hitSlop={6}
                className="active:opacity-60">
                <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary }}>Reset</ThemedText>
              </Pressable>
            ) : null}
          </View>

          {/* Free text first: naming the market you want is the most direct filter
              there is, and it reaches all of Polymarket rather than just this goal's
              pool. */}
          <View style={{ gap: 6 }}>
            <View
              className="flex-row items-center"
              style={{
                gap: 8,
                paddingHorizontal: 12,
                borderRadius: Radius.md,
                borderWidth: 1.5,
                borderColor: filters.keyword.trim() ? Brand[500] : theme.borderStrong,
                backgroundColor: theme.background,
              }}>
              <ThemedText style={{ fontSize: 14, color: theme.textTertiary }}>🔎</ThemedText>
              <TextInput
                value={filters.keyword}
                onChangeText={(keyword) => update({ keyword })}
                placeholder="Search markets — Messi, Tesla, Fed…"
                placeholderTextColor={theme.textTertiary}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                accessibilityLabel="Search prediction markets by keyword"
                style={{ flex: 1, color: theme.text, fontSize: 14, fontWeight: '600', paddingVertical: 10 }}
              />
              {filters.keyword.length > 0 ? (
                <Pressable
                  onPress={() => update({ keyword: '' })}
                  accessibilityRole="button"
                  accessibilityLabel="Clear market search"
                  hitSlop={8}
                  className="active:opacity-60">
                  <ThemedText style={{ fontSize: 15, color: theme.textTertiary }}>✕</ThemedText>
                </Pressable>
              ) : null}
            </View>
            {searchStatus ? (
              <ThemedText style={{ fontSize: 11, color: theme.textTertiary, paddingHorizontal: 2 }}>
                {searchStatus}
              </ThemedText>
            ) : null}
          </View>

          <FilterRow label="Topic">
            <FilterChip label="All" active={filters.predictionTopic === null} onPress={() => update({ predictionTopic: null })} />
            {PREDICTION_TOPICS.map((topic) => (
              <FilterChip
                key={topic.value}
                label={`${topic.emoji} ${topic.label}`}
                active={filters.predictionTopic === topic.value}
                onPress={() => update({ predictionTopic: filters.predictionTopic === topic.value ? null : topic.value })}
              />
            ))}
          </FilterRow>

          <FilterRow label="Resolves">
            {RESOLUTION_WINDOWS.map(({ label, days }) => (
              <FilterChip
                key={label}
                label={label}
                active={filters.maxDaysToResolve === days}
                onPress={() => update({ maxDaysToResolve: filters.maxDaysToResolve === days ? null : days })}
              />
            ))}
          </FilterRow>

          <View className="flex-row items-center justify-between" style={{ gap: 10 }}>
            <ThemedText style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary }}>
              Group by chance
            </ThemedText>
            <Pressable
              onPress={() => update({ groupByChance: !filters.groupByChance })}
              accessibilityRole="switch"
              accessibilityState={{ checked: filters.groupByChance }}
              hitSlop={6}
              className="active:opacity-70"
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: Radius.pill,
                borderWidth: 1,
                borderColor: filters.groupByChance ? Brand[500] : theme.border,
                backgroundColor: filters.groupByChance ? Brand[500] + '1A' : 'transparent',
              }}>
              <ThemedText style={{ fontSize: 12, fontWeight: '800', color: filters.groupByChance ? Brand[500] : theme.textSecondary }}>
                {filters.groupByChance ? 'On' : 'Off'}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      ) : null}

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
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1, borderColor: active ? activeColor : theme.border, backgroundColor: active ? activeColor + '1A' : theme.backgroundElement }}>
      <ThemedText style={{ fontSize: 13, fontWeight: active ? '800' : '600', color: active ? activeColor : theme.textSecondary }}>{label}</ThemedText>
    </Pressable>
  );
}

function compareAssetClasses(a: string, b: string): number {
  const aIndex = ASSET_CLASS_ORDER.indexOf(a);
  const bIndex = ASSET_CLASS_ORDER.indexOf(b);
  if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
  if (aIndex === -1) return 1;
  if (bIndex === -1) return -1;
  return aIndex - bIndex;
}

function assetClassLabel(category: string): string {
  if (category === 'Polymarket') return 'Prediction markets';
  if (category === 'Savings & Treasuries') return 'Treasuries & cash';
  return category;
}
