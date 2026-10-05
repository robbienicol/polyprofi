import Slider from '@react-native-community/slider';
import { SlidersHorizontal } from 'lucide-react-native';
import { Pressable, ScrollView, Switch, View } from 'react-native';

import { InvestmentAmountControl } from '@/components/routes/InvestmentAmountControl';
import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { Brand, CategoryScale, Radius, Shadow } from '@/constants/theme';
import { useSemanticText, useTheme } from '@/hooks/use-theme';
import { isPredictionCategory, PREDICTION_TOPICS } from '@/lib/prediction-topics';
import type { RouteFilters as Filters, RouteSort } from '@/lib/route-results';
import type { Route } from '@/types/routes';

/*
 * Two shapes of downside, not a win and a loss. They wore `Semantic.negative` and
 * `Semantic.positive`, which said "capital preservation is the good one" — a claim
 * about outcomes that the app is not allowed to make, and a semantic colour used for
 * a category, which `CategoryScale` exists for.
 *
 * The labels changed for the same reason: "capital preservation" read to a first-timer
 * as a promise the money is preserved. These say what actually happens to the stake.
 */
const LOSS_PROFILE_FILTERS: { label: string; value: Route['lossProfile']; color: string }[] = [
  { label: 'Can go to zero', value: 'binary', color: CategoryScale.rust },
  { label: 'Can fall, not vanish', value: 'partial', color: CategoryScale.slate },
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
  // "Default order" named nothing, so the top card could not be trusted as the top
  // card. This says what the ranking is actually ordered by.
  { label: 'Best fit', value: 'score' },
  { label: 'Best chance', value: 'chance' },
  { label: 'Biggest return', value: 'payout' },
  { label: 'Best value', value: 'value' },
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
              onPress={() => onSortChange(value)}
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
  const semantic = useSemanticText();
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
          {/* One colour, and it is ink. The brand was used here to mean "high enough",
              which is the one thing DESIGN.md says the brand never means. */}
          <ThemedText style={{ fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'], color: filters.minimumProbability === 0 ? theme.textSecondary : theme.text }}>
            {filters.minimumProbability === 0 ? 'Any chance' : `${filters.minimumProbability}% or better`}
          </ThemedText>
        </View>
        <Slider
          style={{ width: '100%', height: 44 }}
          accessibilityRole="adjustable"
          accessibilityLabel="Minimum chance of hitting the goal"
          accessibilityValue={{ text: filters.minimumProbability === 0 ? 'Any chance' : `${filters.minimumProbability} percent or better` }}
          minimumValue={0}
          maximumValue={90}
          step={5}
          value={filters.minimumProbability}
          onValueChange={(value) => update({ minimumProbability: Math.round(value) })}
          minimumTrackTintColor={Brand[500]}
          maximumTrackTintColor={theme.borderControl}
          thumbTintColor={filters.minimumProbability === 0 ? theme.textSecondary : Brand[500]}
        />
      </Section>

      {/* Prediction-market depth, shown only once the user has asked for prediction
          markets. Every facet here is meaningless for a T-bill or an index fund, so
          the aggregate list never carries them. */}
      {showPredictionFacets ? (
        <>
          <Divider />
          <View style={{ gap: 12 }}>
            <View className="flex-row items-center justify-between" style={{ gap: 10 }}>
              <ThemedText style={{ fontSize: 11, fontWeight: '900', color: semantic.brand, letterSpacing: 0.8 }}>
                PREDICTION MARKETS
              </ThemedText>
              {anyPredictionFacetActive ? (
                <Pressable
                  onPress={() => update({ predictionTopic: null, maxDaysToResolve: null, groupByChance: false })}
                  accessibilityRole="button"
                  accessibilityLabel="Reset the prediction-market filters"
                  className="active:opacity-60 justify-center"
                  style={{ minHeight: 44, paddingHorizontal: 8 }}>
                  <ThemedText style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary }}>Reset</ThemedText>
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

            {/* A real UISwitch. The pill that rendered the words "On"/"Off" with
                accessibilityRole="switch" bolted onto it was the clearest ported-from-
                the-web tell on the screen, and it was 30pt tall. */}
            <View className="flex-row items-center justify-between" style={{ gap: 10, minHeight: 44 }}>
              <ThemedText style={{ fontSize: 14, fontWeight: '600', color: theme.text, flex: 1 }}>
                Group by chance
              </ThemedText>
              <Switch
                value={filters.groupByChance}
                onValueChange={(next) => update({ groupByChance: next })}
                accessibilityLabel="Group routes by chance of hitting the goal"
                trackColor={{ true: Brand[500], false: theme.borderControl }}
                ios_backgroundColor={theme.borderControl}
              />
            </View>
          </View>
        </>
      ) : null}

      <Divider />

      <Section label="What can happen to your stake">
        <FilterRow>
          {LOSS_PROFILE_FILTERS.map(({ label, value, color }) => (
            <FilterChip key={value} label={label} active={filters.lossProfile === value} activeColor={color} activeTextColor={theme.text} onPress={() => update({ lossProfile: filters.lossProfile === value ? null : value })} />
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
      <ThemedText style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: theme.textSecondary }}>
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

/**
 * A chip is 44pt tall and its selected state is readable at arm's length: the active
 * ink is the text-safe counterpart of the chip's hue, not the fill colour, which sat
 * at 3.2:1 on its own tint. Selection is carried by weight and border as well as by
 * colour, so it survives a screen reader and a colour-blind reader both.
 */
function FilterChip({ label, glyph, active, activeColor = Brand[500], activeTextColor, onPress }: { label: string; glyph?: string; active: boolean; activeColor?: string; activeTextColor?: string; onPress: () => void }): React.ReactElement {
  const theme = useTheme();
  const semantic = useSemanticText();
  const tint = active ? activeTextColor ?? semantic.brand : theme.textSecondary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className="flex-row items-center"
      style={{ gap: 6, paddingHorizontal: 14, minHeight: 44, borderRadius: Radius.pill, borderWidth: active ? 2 : 1, borderColor: active ? activeColor : theme.borderControl, backgroundColor: active ? activeColor + '1A' : theme.backgroundElement }}>
      {glyph ? <Icon glyph={glyph} size={14} color={tint} /> : null}
      <ThemedText style={{ fontSize: 14, fontWeight: active ? '800' : '600', color: tint }}>{label}</ThemedText>
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
