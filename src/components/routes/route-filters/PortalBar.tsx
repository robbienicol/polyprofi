import { View } from 'react-native';

import { FilterChip, FilterRow } from '@/components/routes/route-filters/filter-parts';
import { leagueIcon, subcategoryIcon, topicIcon } from '@/components/ui/route-icons';
import { isPredictionCategory, PREDICTION_SUBTOPICS, PREDICTION_TOPICS } from '@/lib/prediction-topics';
import type { RouteFilters as Filters } from '@/lib/route-results';
import { subcategoriesFor } from '@/lib/route-subcategories';
import type { Route } from '@/types/routes';

// 'Cut spending' is an asset class here in the sense that matters to this screen: a
// way of reaching the goal, ranked by the same score. It sits beside the other
// capital-preserving ones rather than last, where an unlisted category would fall.
const ASSET_CLASS_ORDER = ['Polymarket', 'Savings & Treasuries', 'Cut spending', 'Card rewards', 'Stocks & ETFs', 'Crypto'];

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
  const subcategories = filters.category && !inPrediction ? subcategoriesFor(routes, filters.category) : [];

  return (
    <View style={{ gap: 8 }}>
      <FilterRow>
        <FilterChip label="All" active={filters.category === null} onPress={() => update({ category: null, predictionTopic: null, predictionSubtopic: null, subcategory: null })} />
        {assetClasses.map((category) => (
          <FilterChip
            key={category}
            label={assetClassLabel(category)}
            active={filters.category === category}
            onPress={() => update({ category, predictionTopic: null, predictionSubtopic: null, subcategory: null })}
          />
        ))}
      </FilterRow>
      {subcategories.length > 0 ? (
        <FilterRow>
          <FilterChip label="All" active={!filters.subcategory} onPress={() => update({ subcategory: null })} />
          {subcategories.map((sub) => (
            <FilterChip
              key={sub.value}
              label={sub.label}
              icon={subcategoryIcon(sub.value)}
              glyph={sub.emoji}
              active={filters.subcategory === sub.value}
              onPress={() => update({ subcategory: sub.value })}
            />
          ))}
        </FilterRow>
      ) : null}
      {inPrediction && topics.length > 0 ? (
        <FilterRow>
          <FilterChip label="All topics" active={filters.predictionTopic === null} onPress={() => update({ predictionTopic: null, predictionSubtopic: null })} />
          {topics.map((topic) => (
            <FilterChip
              key={topic.value}
              label={topic.label}
              icon={topicIcon(topic.value)}
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
              icon={leagueIcon(league.value)}
              active={filters.predictionSubtopic === league.value}
              onPress={() => update({ predictionSubtopic: league.value })}
            />
          ))}
        </FilterRow>
      ) : null}
    </View>
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
