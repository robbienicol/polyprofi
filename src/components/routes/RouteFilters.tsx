import Slider from '@react-native-community/slider';
import { Pressable, View } from 'react-native';

import { ChanceHistogram } from '@/components/routes/route-filters/ChanceHistogram';
import { Divider, FilterChip, FilterRow, Section } from '@/components/routes/route-filters/filter-parts';
import { ThemedText } from '@/components/themed-text';
import { Brand, CategoryScale, OnBrand, Radius, Shadow } from '@/constants/theme';
import { useSemanticText, useTheme } from '@/hooks/use-theme';
import { isPredictionCategory } from '@/lib/prediction-topics';
import type { RouteFilters as Filters } from '@/lib/route-results';
import type { Route } from '@/types/routes';

export { PortalBar } from '@/components/routes/route-filters/PortalBar';
export { SortBar } from '@/components/routes/route-filters/SortBar';

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

const RESOLUTION_WINDOWS: readonly { label: string; days: number }[] = [
  { label: 'Days', days: 7 },
  { label: 'Weeks', days: 30 },
  { label: 'Months', days: 120 },
];

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
