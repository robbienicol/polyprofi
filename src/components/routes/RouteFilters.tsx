import Slider from '@react-native-community/slider';
import { SlidersHorizontal } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { Brand, CategoryScale, OnBrand, Radius, Shadow } from '@/constants/theme';
import { useSemanticText, useTheme } from '@/hooks/use-theme';
import { isPredictionCategory, PREDICTION_SUBTOPICS, PREDICTION_TOPICS } from '@/lib/prediction-topics';
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
  { label: 'Best odds', value: 'score' },
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

/**
 * Portals: one asset class at a time, and inside prediction markets one topic and one
 * league at a time. Ranking an NFL game against a German table-tennis match helps no
 * one — the edge in a prediction market is what you know, so the list should only
 * hold what you know. Lives on the list, not in Filters, because it is the first
 * choice people make, not a refinement.
 */
export function PortalBar({
  routes,
  filters,
  onChange,
}: {
  routes: Route[];
  filters: Filters;
  onChange: (filters: Filters) => void;
}): React.ReactElement {
  const update = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const assetClasses = [...new Set(routes.map((route) => route.category))].sort(compareAssetClasses);
  const inPrediction = isPredictionCategory(filters.category);
  const predictionRoutes = routes.filter((route) => isPredictionCategory(route.category));
  const topics = PREDICTION_TOPICS.filter((topic) => predictionRoutes.some((route) => route.predictionTopic === topic.value));
  const leagues = PREDICTION_SUBTOPICS.filter((sub) =>
    sub.topic === filters.predictionTopic && predictionRoutes.some((route) => route.predictionSubtopic === sub.value));

  return (
    <View style={{ gap: 8 }}>
      <FilterRow>
        <FilterChip label="All" active={filters.category === null} onPress={() => update({ category: null, predictionTopic: null, predictionSubtopic: null })} />
        {assetClasses.map((category) => (
          <FilterChip
            key={category}
            label={assetClassLabel(category)}
            active={filters.category === category}
            onPress={() => update({ category, predictionTopic: null, predictionSubtopic: null })}
          />
        ))}
      </FilterRow>
      {inPrediction && topics.length > 0 ? (
        <FilterRow>
          <FilterChip label="All topics" active={filters.predictionTopic === null} onPress={() => update({ predictionTopic: null, predictionSubtopic: null })} />
          {topics.map((topic) => (
            <FilterChip
              key={topic.value}
              label={topic.label}
              glyph={topic.emoji}
              active={filters.predictionTopic === topic.value}
              onPress={() => update({ predictionTopic: topic.value, predictionSubtopic: null })}
            />
          ))}
        </FilterRow>
      ) : null}
      {inPrediction && leagues.length > 0 ? (
        <FilterRow>
          <FilterChip label="All leagues" active={!filters.predictionSubtopic} onPress={() => update({ predictionSubtopic: null })} />
          {leagues.map((league) => (
            <FilterChip
              key={league.value}
              label={league.label}
              active={filters.predictionSubtopic === league.value}
              onPress={() => update({ predictionSubtopic: league.value })}
            />
          ))}
        </FilterRow>
      ) : null}
    </View>
  );
}

interface RouteFiltersProps {
  filters: Filters;
  /** Every ranked route before filtering: the asset classes and the chance histogram. */
  routes: Route[];
  /** How many routes the current filters leave, for the live count. */
  shownCount: number;
  onChange: (filters: Filters) => void;
  onDone: () => void;
}

export function RouteFilters({
  filters,
  routes,
  shownCount,
  onChange,
  onDone,
}: RouteFiltersProps): React.ReactElement {
  const theme = useTheme();
  const semantic = useSemanticText();
  const update = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  // The histogram answers "what does this slider cost me?" for the rest of the
  // filters as set, so it narrows with asset class and stake shape but not chance.
  const chancePool = routes.filter((route) => (
    (filters.category == null || route.category === filters.category)
    && (filters.lossProfile == null || route.lossProfile === filters.lossProfile)
  ));
  // The asset-class chip is the intent signal: selecting prediction markets is how a
  // user asks to go deep, so that is what reveals the facets.
  const showPredictionFacets = isPredictionCategory(filters.category);
  const anyPredictionFacetActive = filters.maxDaysToResolve != null;

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
      <Section label="Chance of hitting goal">
        <View className="flex-row justify-between items-center">
          {/* One colour, and it is ink. The brand was used here to mean "high enough",
              which is the one thing DESIGN.md says the brand never means. */}
          <ThemedText style={{ fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'], color: filters.minimumProbability === 0 ? theme.textSecondary : theme.text }}>
            {filters.minimumProbability === 0 ? 'Any chance' : `${filters.minimumProbability}% or better`}
          </ThemedText>
        </View>
        <ChanceHistogram routes={chancePool} threshold={filters.minimumProbability} />
        <Slider
          style={{ width: '100%', height: 44, marginTop: -10 }}
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
                  onPress={() => update({ maxDaysToResolve: null, groupByChance: false })}
                  accessibilityRole="button"
                  accessibilityLabel="Reset the prediction-market filters"
                  className="active:opacity-60 justify-center"
                  style={{ minHeight: 44, paddingHorizontal: 8 }}>
                  <ThemedText style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary }}>Reset</ThemedText>
                </Pressable>
              ) : null}
            </View>

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

      {/* The live count: every change above lands here at once, so the cost of a
          filter is visible before the panel is closed. */}
      <View
        className="flex-row items-center justify-between"
        style={{ gap: 12, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12 }}>
        <ThemedText style={{ fontSize: 13, color: theme.textSecondary, flex: 1 }}>
          <ThemedText style={{ fontSize: 13, fontWeight: '800', color: theme.text, fontVariant: ['tabular-nums'] }}>
            {shownCount}
          </ThemedText>
          {' '}of {routes.length} routes
        </ThemedText>
        <Pressable
          onPress={onDone}
          accessibilityRole="button"
          className="justify-center active:opacity-80"
          style={{ minHeight: 40, paddingHorizontal: 16, borderRadius: Radius.pill, backgroundColor: Brand[500] }}>
          <ThemedText style={{ fontSize: 14, fontWeight: '800', color: OnBrand }}>
            {shownCount === 0 ? 'No routes' : `Show ${shownCount} route${shownCount === 1 ? '' : 's'}`}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

/** Routes counted into 5-point chance bins, matching the slider's step: 0–4 … 85–89, 90+. */
const CHANCE_BINS = 19;
const HISTOGRAM_HEIGHT = 36;

/**
 * How the routes spread across chance of hitting the goal, drawn right on top of the
 * slider so dragging it visibly greys out the bars it cuts. Without it the slider was
 * a blind number: nothing said whether 60% kept three routes or thirty.
 */
function ChanceHistogram({ routes, threshold }: { routes: Route[]; threshold: number }): React.ReactElement {
  const theme = useTheme();
  const counts = new Array<number>(CHANCE_BINS).fill(0);
  for (const route of routes) {
    const bin = Math.min(CHANCE_BINS - 1, Math.max(0, Math.floor(route.probability / 5)));
    counts[bin] += 1;
  }
  const max = Math.max(1, ...counts);
  return (
    <View
      className="flex-row items-end"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      // Inset by roughly the slider thumb's radius, so bin 0 sits over 0% and the last
      // bin over 90%.
      style={{ height: HISTOGRAM_HEIGHT, gap: 2, paddingHorizontal: 10, marginTop: 4 }}>
      {counts.map((count, bin) => (
        <View
          key={bin}
          style={{
            flex: 1,
            height: count === 0 ? 2 : Math.max(4, (count / max) * HISTOGRAM_HEIGHT),
            borderTopLeftRadius: 2,
            borderTopRightRadius: 2,
            backgroundColor: count === 0
              ? theme.border
              : bin * 5 >= threshold ? Brand[500] : theme.borderControl,
          }}
        />
      ))}
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
