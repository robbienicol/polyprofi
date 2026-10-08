import { CARD_BY_ID, CASH_POINT_VALUES } from '@/lib/card-rewards/catalog';
import type { CardCategory, CatalogCard, CategorySpend, WalletResult } from '@/lib/card-rewards/types';

/**
 * Wallet math, ported from Basel's optimizer (trybasel/src/lib/optimizer.ts): one
 * card per category, because a routing rule has to be simple enough to follow at a
 * register, with annual caps honoured greedily so a capped bonus goes where it is
 * worth most. Everything is in annual dollars at cash point values.
 */

/** Annualized spend on one account, by category. */
export interface AccountSpend {
  accountId: string;
  /** Catalog card this account is, or a generic stand-in. */
  cardId: string;
  byCategory: Partial<Record<CardCategory, number>>;
}

interface CapPool { remaining: number }

function capKey(card: CatalogCard, categories: CardCategory[]): string {
  return `${card.id}:${categories.join('+')}`;
}

function poolsFor(cards: CatalogCard[]): Map<string, CapPool> {
  const pools = new Map<string, CapPool>();
  for (const card of cards) {
    for (const rule of card.earnRules) {
      if (rule.annualCapUsd) pools.set(capKey(card, rule.categories), { remaining: rule.annualCapUsd });
    }
  }
  return pools;
}

/** Reward dollars for putting `amount` of `category` on `card`, drawing down its caps when `commit`. */
function earn(card: CatalogCard, category: CardCategory, amount: number, pools: Map<string, CapPool>, commit: boolean): number {
  const cents = CASH_POINT_VALUES[card.currency] ?? 1;
  const rule = card.earnRules.find((entry) => entry.categories.includes(category));
  if (!rule) return amount * card.baseRate * cents * 0.01;
  if (!rule.annualCapUsd) return amount * rule.rate * cents * 0.01;
  const pool = pools.get(capKey(card, rule.categories));
  const remaining = pool?.remaining ?? 0;
  const bonused = Math.min(amount, remaining);
  if (commit && pool) pool.remaining -= bonused;
  return (bonused * rule.rate + (amount - bonused) * card.baseRate) * cents * 0.01;
}

/** The best routing of `spend` across `cardIds`, one card per category. */
export function evaluateWallet(cardIds: string[], spend: CategorySpend[]): WalletResult {
  const cards = [...new Set(cardIds)].map((id) => CARD_BY_ID[id]).filter(Boolean);
  const pools = poolsFor(cards);
  const assignment: WalletResult['assignment'] = {};
  const earnedByCategory: WalletResult['earnedByCategory'] = {};
  let gross = 0;

  for (const entry of [...spend].sort((a, b) => b.totalUsd - a.totalUsd)) {
    let best: { card: CatalogCard; value: number } | null = null;
    for (const card of cards) {
      const value = earn(card, entry.category, entry.totalUsd, pools, false);
      if (!best || value > best.value) best = { card, value };
    }
    if (!best) continue;
    const committed = earn(best.card, entry.category, entry.totalUsd, pools, true);
    assignment[entry.category] = best.card.id;
    earnedByCategory[entry.category] = committed;
    gross += committed;
  }

  const fees = cards.reduce((sum, card) => sum + card.annualFeeUsd, 0);
  return {
    cardIds: cards.map((card) => card.id),
    assignment,
    earnedByCategory,
    grossRewardsUsd: gross,
    annualFeesUsd: fees,
    netRewardsUsd: gross - fees,
  };
}

/** What the accounts actually earned, every dollar left on the account it really went through. */
export function evaluateActualUsage(accounts: AccountSpend[]): WalletResult {
  const heldIds = [...new Set(accounts.map((account) => account.cardId))].filter((id) => CARD_BY_ID[id]);
  const cards = heldIds.map((id) => CARD_BY_ID[id]);
  const pools = poolsFor(cards);
  const earnedByCategory: WalletResult['earnedByCategory'] = {};
  const carried = new Map<CardCategory, Map<string, number>>();
  let gross = 0;

  for (const account of accounts) {
    const card = CARD_BY_ID[account.cardId];
    if (!card) continue;
    for (const [category, amount] of Object.entries(account.byCategory) as [CardCategory, number][]) {
      if (!amount) continue;
      const value = earn(card, category, amount, pools, true);
      gross += value;
      earnedByCategory[category] = (earnedByCategory[category] ?? 0) + value;
      const byCard = carried.get(category) ?? new Map<string, number>();
      byCard.set(card.id, (byCard.get(card.id) ?? 0) + amount);
      carried.set(category, byCard);
    }
  }

  // The card each category mostly goes on today — the "from" in "move gas from X to Y".
  const assignment: WalletResult['assignment'] = {};
  for (const [category, byCard] of carried) {
    assignment[category] = [...byCard.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  const fees = cards.reduce((sum, card) => sum + card.annualFeeUsd, 0);
  return { cardIds: heldIds, assignment, earnedByCategory, grossRewardsUsd: gross, annualFeesUsd: fees, netRewardsUsd: gross - fees };
}

/** Spend by category across every account, annualized. */
export function totalSpend(accounts: AccountSpend[]): CategorySpend[] {
  const totals = new Map<CardCategory, number>();
  for (const account of accounts) {
    for (const [category, amount] of Object.entries(account.byCategory) as [CardCategory, number][]) {
      totals.set(category, (totals.get(category) ?? 0) + (amount ?? 0));
    }
  }
  return [...totals.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([category, totalUsd]) => ({ category, totalUsd }))
    .sort((a, b) => b.totalUsd - a.totalUsd);
}
