import Slider from '@react-native-community/slider';
import { Pressable, ScrollView, View } from 'react-native';

import { InvestmentAmountControl } from '@/components/routes/InvestmentAmountControl';
import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Semantic, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isPredictionCategory, PREDICTION_TOPICS } from '@/lib/prediction-topics';
import type { RouteFilters as Filters, RouteSort } from '@/lib/route-results';
import type { Route } from '@/types/routes';

const LOSS_PROFILE_FILTERS: { label: string; value: Route['lossProfile']; color: string }[] = [
  { label: 'All-or-nothing', value: 'binary', color: Semantic.negative },
  { label: 'Capital preservation', value: 'partial', color: Semantic.positive },
];

// 'Cut spending' is an asset class here in the sense that matters to this screen: a
// way of reaching the goal, ranked by the same score. It sits beside the other
// capital-preserving ones rather than last, where an unlisted category would fall.
const ASSET_CLASS_ORDER = ['Polymarket', 'Savings & Treasuries', 'Cut spending', 'Card rewards', 'Stocks & ETFs', 'Crypto'];

const RESOLUTION_WINDOWS: readonly { label: string; days: number }[] = [
  { label: 'Days', days: 7 },
  { label: 'Weeks', days: 30 },
  { label: 'Months', days: 120 },
];

const SORT_OPTIONS: { label: string; value: RouteSort }[] = [
  { label: 'Default order', value: 'score' },
  { label: 'Best chance', value: 'chance' },
  { label: 'Biggest return', value: 'payout' },
  { label: 'Best expected value', value: 'value' },
];

interface RouteFiltersProps {
  filters: Filters;
  categories: string[];
  onChange: (filters: Filters) => void;
  amount: number;
  investmentMaximum: number;
  onAmountChange: (amount: number) => void;
}

export function RouteFilters({
  filters,
  categories,
  onChange,
  amount,
  investmentMaximum,
  onAmountChange,
}: RouteFiltersProps): React.ReactElement {
  const theme = useTheme();
  const update = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const assetClasses = [...new Set(categories)].sort(compareAssetClasses);
  // The asset-class chip is the intent signal: selecting prediction markets is how a
  // user asks to go deep, so that is what reveals the facets.
  const showPredictionFacets = isPredictionCategory(filters.category);
  const anyPredictionFacetActive = filters.predictionTopic != null
    || filters.maxDaysToResolve != null
    || filters.groupByChance;

  return (
    <View
      style={{
        borderRadius: Radius.xl,
        backgroundColor: theme.backgroundElevated,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 14,
        gap: 14,
        ...Shadow.card,
      }}>
      <InvestmentAmountControl amount={amount} maximum={investmentMaximum} onAmountChange={onAmountChange} />

      <Divider />

      <Section label="Asset class">
        <FilterRow>
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
      </Section>

      <Section label="Chance of hitting goal">
        <View className="flex-row justify-between items-center">
          <ThemedText style={{ fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'], color: filters.minimumProbability === 0 ? theme.textTertiary : filters.minimumProbability >= 65 ? Brand[500] : Semantic.caution }}>
            {filters.minimumProbability === 0 ? 'Any' : `≥ ${filters.minimumProbability}%`}
          </ThemedText>
        </View>
        <Slider style={{ width: '100%', height: 32 }} minimumValue={0} maximumValue={90} step={5} value={filters.minimumProbability} onValueChange={(value) => update({ minimumProbability: Math.round(value) })} minimumTrackTintColor={Brand[500]} maximumTrackTintColor={theme.backgroundSelected} thumbTintColor={filters.minimumProbability === 0 ? theme.textTertiary : Brand[500]} />
      </Section>

      {/* Prediction-market depth, shown only once the user has asked for prediction
          markets. Every facet here is meaningless for a T-bill or an index fund, so
          the aggregate list never carries them. */}
      {showPredictionFacets ? (
        <>
          <Divider />
          <View style={{ gap: 12 }}>
            <View className="flex-row items-center justify-between" style={{ gap: 10 }}>
              <ThemedText style={{ fontSize: 11, fontWeight: '900', color: Brand[500], letterSpacing: 0.8 }}>
                PREDICTION MARKETS
              </ThemedText>
              {anyPredictionFacetActive ? (
                <Pressable
                  onPress={() => update({ predictionTopic: null, maxDaysToResolve: null, groupByChance: false })}
                  accessibilityRole="button"
                  hitSlop={6}
                  className="active:opacity-60">
                  <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary }}>Reset</ThemedText>
                </Pressable>
              ) : null}
            </View>

            <Section label="Topic">
              <FilterRow>
                <FilterChip label="All" active={filters.predictionTopic === null} onPress={() => update({ predictionTopic: null })} />
                {PREDICTION_TOPICS.map((topic) => (
                  <FilterChip
                    key={topic.value}
                    label={topic.label}
                    glyph={topic.emoji}
                    active={filters.predictionTopic === topic.value}
                    onPress={() => update({ predictionTopic: filters.predictionTopic === topic.value ? null : topic.value })}
                  />
                ))}
              </FilterRow>
            </Section>

            <Section label="Resolves">
              <FilterRow>
                {RESOLUTION_WINDOWS.map(({ label, days }) => (
                  <FilterChip
                    key={label}
                    label={label}
                    active={filters.maxDaysToResolve === days}
                    onPress={() => update({ maxDaysToResolve: filters.maxDaysToResolve === days ? null : days })}
                  />
                ))}
              </FilterRow>
            </Section>

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
        </>
      ) : null}

      <Divider />

      <Section label="Risk">
        <FilterRow>
          {LOSS_PROFILE_FILTERS.map(({ label, value, color }) => (
            <FilterChip key={value} label={label} active={filters.lossProfile === value} activeColor={color} onPress={() => update({ lossProfile: filters.lossProfile === value ? null : value })} />
          ))}
        </FilterRow>
      </Section>

      <Section label="Sort by">
        <FilterRow>
          {SORT_OPTIONS.map(({ label, value }) => (
            <FilterChip key={value} label={label} active={filters.sort === value} onPress={() => update({ sort: value })} />
          ))}
        </FilterRow>
      </Section>
    </View>
  );
}

/** A thin rule between filter sections — the whole panel is one card now, so the
 * sections need their own separation instead of the gaps between stacked boxes. */
function Divider(): React.ReactElement {
  const theme = useTheme();
  return <View style={{ height: 1, backgroundColor: theme.border }} />;
}

/** One labelled block inside the Filters card. */
function Section({ label, children }: React.PropsWithChildren<{ label: string }>): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <ThemedText style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: theme.textTertiary }}>
        {label.toUpperCase()}
      </ThemedText>
      {children}
    </View>
  );
}

function FilterRow({ children }: React.PropsWithChildren): React.ReactElement {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {children}
    </ScrollView>
  );
}

function FilterChip({ label, glyph, active, activeColor = Brand[500], onPress }: { label: string; glyph?: string; active: boolean; activeColor?: string; onPress: () => void }): React.ReactElement {
  const theme = useTheme();
  const tint = active ? activeColor : theme.textSecondary;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} className="flex-row items-center" style={{ gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1, borderColor: active ? activeColor : theme.border, backgroundColor: active ? activeColor + '1A' : theme.backgroundElement }}>
      {glyph ? <Icon glyph={glyph} size={13} color={tint} /> : null}
      <ThemedText style={{ fontSize: 13, fontWeight: active ? '800' : '600', color: tint }}>{label}</ThemedText>
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
