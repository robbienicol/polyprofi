import { CRYPTO_UNIVERSE } from '@/lib/crypto-routes';
import { ETF_UNIVERSE } from '@/lib/etf-routes';
import type { Route } from '@/types/routes';

/**
 * The second row of portals: once an asset class is picked, what kinds of thing are
 * inside it. Prediction markets have their own topics and leagues
 * (@/lib/prediction-topics); this covers every other class, read from what the route
 * actually is — never guessed from its copy.
 */
export interface RouteSubcategory {
  value: string;
  label: string;
  emoji?: string;
}

const BOND_FUNDS = new Set(['SGOV', 'BND', 'SCHP', 'MUB', 'BNDX', 'LQD', 'TLT']);

export function routeSubcategory(route: Route): RouteSubcategory | null {
  if (route.spendingCut) {
    if (route.spendingCut.kind === 'subscription') return { value: 'subscriptions', label: 'Subscriptions', emoji: '🔁' };
    const name = route.spendingCut.merchant;
    return { value: `spend-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, label: name };
  }
  if (route.cardRewards) {
    return route.cardRewards.kind === 'new-card'
      ? { value: 'new-card', label: 'New cards', emoji: '✨' }
      : { value: 'reroute', label: 'Cards you have', emoji: '💳' };
  }
  if (route.optionPosition) {
    switch (route.optionPosition.strategy) {
      case 'long-call':
      case 'bull-call-spread': return { value: 'calls', label: 'Calls', emoji: '📈' };
      case 'long-put': return { value: 'puts', label: 'Puts', emoji: '📉' };
      default: return { value: 'income', label: 'Income', emoji: '💵' };
    }
  }
  const crypto = route.id.match(/^crypto-([a-z0-9]+)$/);
  if (crypto) {
    const coin = CRYPTO_UNIVERSE.find((item) => item.ticker.toLowerCase() === crypto[1]);
    return coin ? { value: coin.symbol, label: coin.name, emoji: coin.emoji } : null;
  }
  const etf = route.id.match(/^etf-(.+)$/);
  if (etf) {
    const definition = ETF_UNIVERSE.find((item) => item.symbol.toLowerCase() === etf[1]);
    if (!definition) return null;
    if (definition.kind === 'stock') return { value: 'stocks', label: 'Single stocks', emoji: '🏢' };
    if (BOND_FUNDS.has(definition.symbol)) return { value: 'bonds', label: 'Bonds', emoji: '🧾' };
    if (definition.symbol === 'GLD') return { value: 'gold', label: 'Gold', emoji: '🪙' };
    return { value: 'index', label: 'Index funds', emoji: '📊' };
  }
  if (route.id.startsWith('treasury-')) return { value: 'tbills', label: 'T-bills', emoji: '🏛️' };
  if (route.id.startsWith('savings-account')) return { value: 'savings', label: 'High-yield savings', emoji: '🏦' };
  return null;
}

/**
 * The subcategories present in a class, in first-seen order of the ranked list — so
 * the best-ranked kind comes first. Empty unless there are at least two to choose
 * between: a row with one chip is a label, not a choice.
 */
export function subcategoriesFor(routes: Route[], category: string): RouteSubcategory[] {
  const seen = new Map<string, RouteSubcategory>();
  for (const route of routes) {
    if (route.category !== category) continue;
    const sub = routeSubcategory(route);
    if (sub && !seen.has(sub.value)) seen.set(sub.value, sub);
  }
  return seen.size >= 2 ? [...seen.values()] : [];
}
