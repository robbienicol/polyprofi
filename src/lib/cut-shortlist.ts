import type { Route } from '@/types/routes';

/**
 * Which spending cuts earn a place in the main list, and which wait behind
 * "More ways to save".
 *
 * Every cut needs no capital, is near-certain and puts nothing at risk, so under the
 * shared score each one beats every investment. A statement with ten recurring
 * charges therefore buried the first way to actually grow money under ten ways to
 * spend less. Cuts still stack — you can cancel all of them — so none is thrown away,
 * but only the few that matter for this goal and are easiest to follow through on
 * are shown alongside the investments.
 */

/** A cut has to cover at least this share of the goal by the deadline to be featured. */
export const CUT_MIN_GOAL_SHARE = 0.1;
/** At most this many cuts in the main list. */
export const MAX_FEATURED_CUTS = 3;
/** Of those, at most this many new cards: one application is a plan, three is a spree. */
export const MAX_FEATURED_NEW_CARDS = 1;

/**
 * A way to save rather than to invest: a spending cut, or a card-rewards move.
 * Both need no money and put nothing at risk, which is exactly why they need a
 * cap — the shared score cannot tell them from each other or from free money.
 */
export function isSpendingCut(route: Route): boolean {
  return route.spendingCut != null || route.cardRewards != null;
}

/**
 * Easiest to follow through on first:
 *   0. using the cards you already hold for the right things — nothing given up at all;
 *   1. a new card — five minutes and a credit check, but you keep everything you use;
 *   2. a cancellation — one action, but you lose the thing, and it may be one you use daily;
 *   3. cutting back on a category — a habit that has to hold every week.
 * Within a kind, the more reliable one first, then the one that saves more.
 */
function feasibilityRank(route: Route): number {
  if (route.cardRewards) return route.cardRewards.kind === 'reroute' ? 0 : 1;
  return route.spendingCut?.kind === 'subscription' ? 2 : 3;
}

export function compareCutFeasibility(a: Route, b: Route): number {
  const kindRank = feasibilityRank;
  return kindRank(a) - kindRank(b)
    || b.probability - a.probability
    || b.expectedReturn - a.expectedReturn;
}

export interface CutShortlist {
  /** Ids of the cuts shown in the main list, most feasible first. */
  featuredIds: Set<string>;
  /** Every other cut, most feasible first. They stack, so they are kept, just folded away. */
  more: Route[];
}

export function shortlistCuts(routes: Route[], target: number): CutShortlist {
  const cuts = routes.filter(isSpendingCut).sort(compareCutFeasibility);
  const threshold = target > 0 ? target * CUT_MIN_GOAL_SHARE : 0;
  const featured: Route[] = [];
  let newCards = 0;
  for (const route of cuts) {
    if (featured.length >= MAX_FEATURED_CUTS) break;
    if (route.expectedReturn < threshold) continue;
    if (route.cardRewards?.kind === 'new-card') {
      if (newCards >= MAX_FEATURED_NEW_CARDS) continue;
      newCards += 1;
    }
    featured.push(route);
  }
  const featuredIds = new Set(featured.map((route) => route.id));
  return { featuredIds, more: cuts.filter((route) => !featuredIds.has(route.id)) };
}

/**
 * The main list with only the featured cuts left in it. Under the default ranking
 * the featured cuts keep the slots the score gave them but take them in feasibility
 * order, so the easiest cut is always the first one read.
 */
export function applyCutShortlist(routes: Route[], shortlist: CutShortlist, reorder = true): Route[] {
  const kept = routes.filter((route) => !isSpendingCut(route) || shortlist.featuredIds.has(route.id));
  // A sort the user picked (payout, soonest…) is theirs; leave it alone.
  if (!reorder) return kept;
  const cutsInOrder = kept.filter(isSpendingCut).sort(compareCutFeasibility);
  let next = 0;
  return kept.map((route) => (isSpendingCut(route) ? cutsInOrder[next++] : route));
}

function invariant(condition: boolean, message: string): void {
  if (!condition) throw new Error(`[cut-shortlist] ${message}`);
}

export function __selfCheck(): void {
  const cut = (id: string, kind: 'subscription' | 'discretionary', saved: number, probability: number): Route => ({
    id,
    category: 'Cut spending',
    emoji: '✂️',
    description: id,
    riskLevel: 1,
    probability,
    expectedReturn: saved,
    platform: 'Your bank account',
    strategy: '',
    lossProfile: 'partial',
    meetsTarget: false,
    noCapitalRequired: true,
    spendingCut: { merchant: id, kind, monthlyAmount: saved / 3 },
  });
  const investment: Route = {
    id: 'voo',
    category: 'Stocks & ETFs',
    emoji: '📈',
    description: 'VOO',
    riskLevel: 1,
    probability: 70,
    expectedReturn: 100,
    platform: 'Brokerage',
    strategy: '',
    lossProfile: 'partial',
    meetsTarget: true,
  };

  const doordash = cut('doordash', 'discretionary', 90, 70);
  const hulu = cut('hulu', 'subscription', 54, 97);
  const netflix = cut('netflix', 'subscription', 46, 97);
  const gym = cut('gym', 'subscription', 30, 97);
  const icloud = cut('icloud', 'subscription', 9, 97);
  const coffee = cut('coffee', 'discretionary', 60, 55);
  // Score order: every cut above the investment, the way the shared score puts them.
  const scored = [doordash, hulu, coffee, netflix, gym, icloud, investment];

  const shortlist = shortlistCuts(scored, 100);
  invariant(shortlist.featuredIds.size === MAX_FEATURED_CUTS, 'no more than three cuts are featured');
  invariant(!shortlist.featuredIds.has('icloud'), 'a cut worth under 10% of the goal is not featured');
  invariant(
    [...shortlist.featuredIds].sort().join(',') === 'gym,hulu,netflix',
    'cancellations are featured before habits: one action beats one that has to hold',
  );
  invariant(shortlist.more.map((route) => route.id).join(',') === 'icloud,doordash,coffee',
    'everything else is kept for "more ways to save", easiest first');

  const list = applyCutShortlist(scored, shortlist);
  invariant(list.map((route) => route.id).join(',') === 'hulu,netflix,gym,voo',
    'the investment now shows fourth, not seventh, and the easiest cut reads first');

  // Using the cards you already hold gives nothing up, so it outranks even a cancellation.
  const reroute: Route = { ...cut('reroute', 'subscription', 40, 92), spendingCut: undefined, category: 'Card rewards', cardRewards: { kind: 'reroute', annualGainUsd: 160 } };
  const savor: Route = { ...cut('savor', 'subscription', 219, 70), spendingCut: undefined, category: 'Card rewards', cardRewards: { kind: 'new-card', cardId: 'capital-one-savor-one', annualGainUsd: 77 } };
  const bce: Route = { ...savor, id: 'bce', expectedReturn: 227 };
  const pool = [hulu, netflix, gym, savor, bce, reroute, investment];
  const withCards = shortlistCuts(pool, 100);
  invariant(withCards.featuredIds.has('reroute'), 'a card re-route is featured');
  invariant([...withCards.featuredIds].filter((id) => id === 'savor' || id === 'bce').length === 1,
    'one new card is featured, not a stack of applications');
  invariant(withCards.featuredIds.has('bce'), 'the new card worth more is the one featured');
  invariant(applyCutShortlist(pool, withCards).slice(0, 3).map((route) => route.id).join(',') === 'reroute,bce,hulu',
    'painless re-route, then keep-everything new card, then the biggest cancellation');

  const bigGoal = shortlistCuts(scored, 5_000);
  invariant(bigGoal.featuredIds.size === 0, 'against a $5,000 goal none of these moves the needle');
}
