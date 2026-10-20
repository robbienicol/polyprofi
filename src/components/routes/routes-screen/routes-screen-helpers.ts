import { cancellationActionLabel, cancellationTargetFor } from '@/lib/cancel-links';
import type { RouteFilters as Filters } from '@/lib/route-results';
import type { Route, RouteParams, SavedRoutesBatch } from '@/types/routes';

export const DEFAULT_FILTERS: Filters = {
  category: null,
  lossProfile: null,
  minimumProbability: 0,
  sort: 'score',
  predictionTopic: null,
  predictionSubtopic: null,
  subcategory: null,
  maxDaysToResolve: null,
  groupByChance: false,
  keyword: '',
};

export const NO_ROUTES: Route[] = [];

/** `base` plus whatever in `extra` it doesn't already hold, by id. The same array when nothing is new. */
export function appendNew(base: Route[], extra: Route[]): Route[] {
  if (extra.length === 0) return base;
  const known = new Set(base.map((route) => route.id));
  const fresh = extra.filter((route) => !known.has(route.id));
  return fresh.length === 0 ? base : [...base, ...fresh];
}

/** A unique id for something created now: a tracked position or a preview batch. */
export function stampedId(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

/** Cards mounted at a time. Each carries a live chart, so fewer at once is a faster list. */
export const PAGE_SIZE = 12;

/** Every filter that narrows the list, wherever its control lives. */
export function activeFilterCount(filters: Filters): number {
  return [
    filters.category !== null,
    filters.lossProfile !== null,
    filters.minimumProbability > 0,
    filters.predictionTopic !== null,
    !!filters.subcategory,
    filters.maxDaysToResolve != null,
    filters.groupByChance,
  ].filter(Boolean).length;
}

/**
 * The Filters button counts only what lives behind it: asset class, topic and league
 * are on the list itself now.
 */
export function panelFilterCount(filters: Filters): number {
  return [
    filters.lossProfile !== null,
    filters.minimumProbability > 0,
    filters.maxDaysToResolve != null,
    filters.groupByChance,
  ].filter(Boolean).length;
}

/**
 * The confirm button's words for a subscription cut. Never promises a cancellation
 * the link cannot deliver — an unknown merchant says it is opening a search.
 */
export function cutActionLabel(route: Route): string | null {
  const cut = route.spendingCut;
  if (!cut || cut.kind !== 'subscription') return null;
  return cancellationActionLabel(cancellationTargetFor(cut.merchant), cut.merchant);
}

export function timeframeLabel(timeframe: RouteParams['timeframe']): string {
  return ({ today: 'today', week: 'this week', month: 'this month', '3months': 'in 3 months', '1year': 'this year', '5years': 'in 5 years' })[timeframe];
}

export function formatBatchLabel(batch: SavedRoutesBatch): string {
  const generated = new Date(batch.generatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const percent = batch.quizSnapshot.balance > 0 ? ((batch.quizSnapshot.target / batch.quizSnapshot.balance) * 100).toFixed(0) : '0';
  return `Saved ${generated} · +${percent}% · ${timeframeLabel(batch.quizSnapshot.timeframe)}`;
}
