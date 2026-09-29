import { CARD_BY_ID, CASH_POINT_VALUES, CATALOG, cardDisplayName } from '@/lib/card-rewards/catalog';
import { evaluateActualUsage, evaluateWallet, totalSpend, type AccountSpend } from '@/lib/card-rewards/optimizer';
import { CARD_CATEGORY_LABELS, type CardCategory, type CatalogCard } from '@/lib/card-rewards/types';
import type { Route } from '@/types/routes';

/**
 * Card rewards as routes: the money someone leaves on the table by swiping the
 * wrong card, valued over the goal's own deadline so it competes with every other
 * route on the same terms.
 *
 * Two kinds. Re-routing the cards already held — gas on the card that pays 3% for
 * gas — costs nothing and gives nothing up, so it is the most painless saving the
 * app can offer. A new card adds its welcome bonus, which is the big number over a
 * few months, but it needs an application and a hard credit inquiry, so it is
 * trusted less.
 */

/** What the server sends: annualized spend per linked account, never transactions. */
export interface CardRewardsProfile {
  /** Days of history the spend was measured over, before annualizing. */
  windowDays: number;
  accounts: { accountId: string; label: string; cardId: string; identified: boolean }[];
  spend: AccountSpend[];
  asOf: string;
}

/** How sure a plan is to pay off. Re-routing is one habit; a new card needs approval and the minimum spend. */
const REROUTE_RELIABILITY = 92;
const NEW_CARD_RELIABILITY = 70;
/** Bonuses post a statement or so after the minimum spend is met. */
const BONUS_POSTING_DAYS = 30;
const MAX_NEW_CARD_ROUTES = 3;

function cardLabel(id: string): string {
  const card = CARD_BY_ID[id];
  if (!card) return id;
  return `your ${card.name}`;
}

function listOf(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function over(deadlineDays: number): string {
  const months = Math.round(deadlineDays / 30);
  if (months <= 1) return deadlineDays <= 14 ? `in ${Math.round(deadlineDays)} days` : 'in a month';
  return `over the next ${months} months`;
}

function bonusDollars(card: CatalogCard): number {
  if (!card.welcomeBonus) return 0;
  return card.currency === 'cash'
    ? card.welcomeBonus.amount
    : (card.welcomeBonus.amount * CASH_POINT_VALUES[card.currency]) / 100;
}

function money(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

export function buildCardRewardRoutes({
  profile,
  target,
  deadlineDays,
}: {
  profile: CardRewardsProfile;
  target: number;
  deadlineDays: number;
}): Route[] {
  const spend = totalSpend(profile.spend);
  const annualSpend = spend.reduce((sum, entry) => sum + entry.totalUsd, 0);
  if (annualSpend < 1 || deadlineDays <= 0) return [];

  // Everything below is annual; the goal is not. A card fee is charged the day the
  // account opens, but rewards arrive a purchase at a time.
  const share = Math.min(1, deadlineDays / 365);
  const current = evaluateActualUsage(profile.spend);
  const held = current.cardIds;
  const rerouted = evaluateWallet(held, spend);
  const routes: Route[] = [];

  // ── The cards already in the wallet, used right ────────────────────────────
  const moves = spend
    .map((entry) => ({
      category: entry.category,
      from: current.assignment[entry.category],
      to: rerouted.assignment[entry.category],
      annualGain: (rerouted.earnedByCategory[entry.category] ?? 0) - (current.earnedByCategory[entry.category] ?? 0),
    }))
    .filter((move) => move.to && move.from !== move.to && move.annualGain >= 1)
    .sort((a, b) => b.annualGain - a.annualGain);
  const rerouteGain = (rerouted.grossRewardsUsd - current.grossRewardsUsd) * share;
  if (moves.length > 0 && rerouteGain >= 1) {
    const phrase = (move: typeof moves[number]) =>
      `${CARD_CATEGORY_LABELS[move.category]} on ${cardLabel(move.to!)}${move.from ? ` instead of ${cardLabel(move.from)}` : ''}`;
    // One instruction per card swap — "groceries and gas on your Amex instead of your
    // debit card" — not one per category, biggest swap first.
    const swaps = new Map<string, { to: string; from?: string; categories: CardCategory[]; gain: number }>();
    for (const move of moves) {
      const key = `${move.to}|${move.from ?? ''}`;
      const swap = swaps.get(key) ?? { to: move.to!, from: move.from, categories: [], gain: 0 };
      swap.categories.push(move.category);
      swap.gain += move.annualGain;
      swaps.set(key, swap);
    }
    const swapPhrases = [...swaps.values()]
      .sort((a, b) => b.gain - a.gain)
      .map((swap) => `${listOf(swap.categories.map((category) => CARD_CATEGORY_LABELS[category]))} on ${cardLabel(swap.to)}${swap.from ? ` instead of ${cardLabel(swap.from)}` : ''}`);
    const saved = Math.round(rerouteGain);
    routes.push({
      id: 'card-reroute',
      category: 'Card rewards',
      emoji: '💳',
      description: `Swipe the right card you already have: put ${swapPhrases.slice(0, 2).join('; and ')}. About +${money(saved)} ${over(deadlineDays)}, no new card.`,
      riskLevel: 1,
      probability: REROUTE_RELIABILITY,
      expectedReturn: saved,
      platform: 'Cards you already have',
      strategy: [
        `Measured on your last ${Math.round(profile.windowDays)} days of spending across your linked accounts, annualized.`,
        ...moves.map((move) => `• ${phrase(move)}: +${money(move.annualGain)} a year.`),
        'Nothing to apply for and nothing given up — just which card comes out at the register. Update the card on file for anything that bills automatically.',
      ].join('\n'),
      lossProfile: 'partial',
      meetsTarget: saved >= target,
      noCapitalRequired: true,
      cardRewards: { kind: 'reroute', annualGainUsd: Math.round(rerouted.grossRewardsUsd - current.grossRewardsUsd) },
    });
  }

  // ── A card worth adding ────────────────────────────────────────────────────
  const monthlySpend = annualSpend / 12;
  const candidates = CATALOG.filter((card) => !held.includes(card.id)).map((card) => {
    const wallet = evaluateWallet([...held, card.id], spend);
    const incremental = Math.max(0, wallet.grossRewardsUsd - rerouted.grossRewardsUsd);
    // The welcome bonus only counts if ordinary spending meets the minimum inside
    // both the offer's window and the goal's — nobody should buy things to chase it.
    const monthsToBonus = card.welcomeBonus ? card.welcomeBonus.minSpendUsd / monthlySpend : Infinity;
    const bonusInTime = card.welcomeBonus != null
      && monthsToBonus <= card.welcomeBonus.withinMonths
      && monthsToBonus * 30 + BONUS_POSTING_DAYS <= deadlineDays;
    const bonus = bonusInTime ? bonusDollars(card) : 0;
    const routedHere = spend
      .filter((entry) => wallet.assignment[entry.category] === card.id)
      .reduce((sum, entry) => sum + entry.totalUsd, 0);
    const extra = card.firstYearExtra
      ? (Math.min(routedHere * share, card.firstYearExtra.capUsd) * card.firstYearExtra.rate) / 100
      : 0;
    const value = incremental * share + bonus + extra - card.annualFeeUsd;
    const wins = spend
      .filter((entry) => wallet.assignment[entry.category] === card.id && entry.category !== 'other')
      .map((entry) => entry.category);
    return { card, value, bonus, bonusInTime, monthsToBonus, incremental, wins };
  })
    .filter((candidate) => candidate.value >= 1)
    .sort((a, b) => b.value - a.value)
    .slice(0, MAX_NEW_CARD_ROUTES);

  for (const { card, value, bonus, bonusInTime, monthsToBonus, incremental, wins } of candidates) {
    const saved = Math.round(value);
    const rateFor = (category: CardCategory) => {
      const rule = card.earnRules.find((entry) => entry.categories.includes(category));
      const rate = (rule ? rule.rate : card.baseRate) * CASH_POINT_VALUES[card.currency];
      return `${Number(rate.toFixed(1))}% ${CARD_CATEGORY_LABELS[category]}`;
    };
    const flat = `${Number((card.baseRate * CASH_POINT_VALUES[card.currency]).toFixed(1))}% on everything`;
    const perks = card.earnRules.length === 0 || wins.length === 0 ? flat : wins.slice(0, 2).map(rateFor).join(' and ');
    const lead = bonusInTime && card.welcomeBonus
      ? `${money(bonus)} bonus after ${money(card.welcomeBonus.minSpendUsd)} of your normal spending, plus ${perks}`
      : perks;
    routes.push({
      id: `card-new-${card.id}`,
      category: 'Card rewards',
      emoji: '💳',
      description: `Open the ${cardDisplayName(card.id)}: ${lead}. About +${money(saved)} ${over(deadlineDays)}.`,
      riskLevel: 2,
      probability: NEW_CARD_RELIABILITY,
      expectedReturn: saved,
      platform: card.issuer,
      strategy: [
        card.angle,
        bonusInTime && card.welcomeBonus
          ? `At your pace (${money(monthlySpend)} a month on cards) you'd reach the ${money(card.welcomeBonus.minSpendUsd)} minimum in about ${Math.max(1, Math.round(monthsToBonus * 4.3))} weeks; the bonus posts a statement or so later.`
          : card.welcomeBonus
            ? `Its welcome bonus isn't counted: your normal spending wouldn't reach the ${money(card.welcomeBonus.minSpendUsd)} minimum in time for this goal.`
            : null,
        incremental >= 1 ? `On top of the cards you have, it adds about ${money(incremental)} a year.` : null,
        card.annualFeeUsd > 0 ? `Already net of its ${money(card.annualFeeUsd)} annual fee, charged when the account opens.` : 'No annual fee.',
        'Needs approval and a hard credit inquiry. Pay it in full every month — one month of interest wipes out the reward — and never spend more than you would anyway to hit a bonus.',
      ].filter(Boolean).join('\n'),
      lossProfile: 'partial',
      meetsTarget: saved >= target,
      noCapitalRequired: true,
      cardRewards: { kind: 'new-card', cardId: card.id, cardName: cardDisplayName(card.id), applyUrl: card.applyUrl, annualGainUsd: Math.round(incremental) },
    });
  }

  return routes;
}

function invariant(condition: boolean, message: string): void {
  if (!condition) throw new Error(`[card-reward-routes] ${message}`);
}

export function __selfCheck(): void {
  // $300/mo gas and $400/mo groceries on a debit card, $300/mo dining on a Blue Cash
  // Everyday: gas and groceries belong on the Amex.
  const profile: CardRewardsProfile = {
    windowDays: 90,
    asOf: '2026-09-23',
    accounts: [
      { accountId: 'a', label: 'Checking', cardId: 'generic-debit', identified: false },
      { accountId: 'b', label: 'Blue Cash Everyday', cardId: 'blue-cash-everyday', identified: true },
    ],
    spend: [
      { accountId: 'a', cardId: 'generic-debit', byCategory: { gas_ev: 3_600, groceries: 4_800 } },
      { accountId: 'b', cardId: 'blue-cash-everyday', byCategory: { restaurants: 3_600 } },
    ],
  };
  const routes = buildCardRewardRoutes({ profile, target: 100, deadlineDays: 90 });
  const reroute = routes.find((route) => route.id === 'card-reroute');
  invariant(reroute != null, 'money on a debit card with a 3% card in the wallet is a re-route');
  // Gas $3,600 + groceries capped at $6k shared… each has its own $6k cap here: 3% of $8,400 = $252/yr → ~$62 over 90 days.
  invariant(reroute!.expectedReturn === 62, `re-routing is valued over the deadline, not the year (got ${reroute!.expectedReturn})`);
  invariant(reroute!.noCapitalRequired === true && reroute!.probability > 90, 're-routing needs nothing and almost always holds');
  invariant(reroute!.description.includes('instead of your debit card'), 'the move names where the spending is today');

  const newCards = routes.filter((route) => route.cardRewards?.kind === 'new-card');
  invariant(newCards.length > 0 && newCards.length <= MAX_NEW_CARD_ROUTES, 'a few new cards, not the catalog');
  invariant(!newCards.some((route) => route.id === 'card-new-blue-cash-everyday'), 'never recommends a card already held');
  invariant(newCards.every((route) => route.probability < reroute!.probability), 'a new card is trusted less than using the ones you have');
  const flex = newCards.find((route) => route.id === 'card-new-capital-one-savor-one' || route.id === 'card-new-freedom-flex');
  invariant(flex != null && flex.expectedReturn >= 200, 'a $200 bonus reachable on normal spending within the deadline counts');

  const tooSoon = buildCardRewardRoutes({ profile, target: 100, deadlineDays: 20 });
  invariant(!tooSoon.some((route) => route.expectedReturn >= 200), 'a bonus that cannot post before the deadline is not counted');

  const nothing = buildCardRewardRoutes({ profile: { ...profile, spend: [] }, target: 100, deadlineDays: 90 });
  invariant(nothing.length === 0, 'no spending, no card routes');
}
