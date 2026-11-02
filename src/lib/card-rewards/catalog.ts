import type { CatalogCard, RewardCurrency } from '@/lib/card-rewards/types';

/**
 * The consumer card catalog, ported from Basel's (trybasel/src/lib/catalog.ts).
 * Rates, caps, fees and welcome offers reflect Basel's last verification; its
 * business cards are left out, since nobody here is routing a company's ad spend.
 *
 * Point values are what a point is worth as CASH, not as travel. Basel values
 * transferable points above a cent because a business optimizing travel can get
 * that; a goal of "$100 by December" is paid in dollars, and that is what a point
 * redeems to without a trip attached.
 */
export const CASH_POINT_VALUES: Record<RewardCurrency, number> = {
  cash: 1,
  ur: 1, // Chase Ultimate Rewards: 1¢ cash back on every Chase card
  mr: 0.6, // Amex Membership Rewards: statement credit
  c1: 0.5, // Capital One miles: cash redemption (1¢ only against travel)
};

export const CATALOG: CatalogCard[] = [
  {
    id: 'sapphire-preferred',
    issuer: 'Chase',
    name: 'Sapphire Preferred',
    currency: 'ur',
    annualFeeUsd: 95,
    baseRate: 1,
    earnRules: [
      { categories: ['restaurants'], rate: 3, note: '3x dining' },
      { categories: ['streaming'], rate: 3, note: '3x select streaming' },
      { categories: ['groceries'], rate: 3, note: '3x online grocery (not superstores)' },
      { categories: ['travel_air', 'travel_hotel', 'travel_ground'], rate: 2, note: '2x travel' },
    ],
    welcomeBonus: { amount: 60_000, minSpendUsd: 5_000, withinMonths: 3 },
    angle: 'Strong on dining and travel; points transfer out.',
    applyUrl: 'https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred',
    accountMatch: /sapphire\s*preferred/i,
    verifiedAt: '2026-07-20',
  },
  {
    id: 'freedom-unlimited',
    issuer: 'Chase',
    name: 'Freedom Unlimited',
    currency: 'ur',
    annualFeeUsd: 0,
    baseRate: 1.5,
    earnRules: [
      { categories: ['restaurants'], rate: 3, note: '3% dining' },
      { categories: ['drugstores'], rate: 3, note: '3% drugstores' },
    ],
    firstYearExtra: { rate: 1.5, capUsd: 20_000 },
    angle: 'No-fee 1.5% on everything, 3% dining and drugstores.',
    applyUrl: 'https://creditcards.chase.com/cash-back-credit-cards/freedom/unlimited',
    accountMatch: /freedom\s*unlimited/i,
    verifiedAt: '2026-07-20',
  },
  {
    id: 'freedom-flex',
    issuer: 'Chase',
    name: 'Freedom Flex',
    currency: 'ur',
    annualFeeUsd: 0,
    baseRate: 1,
    earnRules: [
      { categories: ['restaurants'], rate: 3, note: '3% dining' },
      { categories: ['drugstores'], rate: 3, note: '3% drugstores' },
    ],
    welcomeBonus: { amount: 200, minSpendUsd: 500, withinMonths: 3 },
    angle: '3% dining and drugstores plus rotating 5% quarters (not counted here).',
    applyUrl: 'https://creditcards.chase.com/cash-back-credit-cards/freedom/flex',
    accountMatch: /freedom\s*flex/i,
    verifiedAt: '2026-07-20',
  },
  {
    id: 'amex-gold',
    issuer: 'American Express',
    name: 'Gold Card',
    currency: 'mr',
    annualFeeUsd: 325,
    baseRate: 1,
    earnRules: [
      { categories: ['restaurants'], rate: 4, note: '4x dining' },
      { categories: ['groceries'], rate: 4, annualCapUsd: 25_000, note: '4x U.S. supermarkets, first $25k/yr' },
      { categories: ['travel_air'], rate: 3, note: '3x flights booked direct' },
    ],
    welcomeBonus: { amount: 60_000, minSpendUsd: 6_000, withinMonths: 6 },
    angle: '4x dining and groceries, for the points-minded.',
    applyUrl: 'https://www.americanexpress.com/us/credit-cards/card/gold-card/',
    accountMatch: /\bgold\s*card\b|amex\s*gold|american\s*express\s*gold/i,
    verifiedAt: '2026-07-20',
  },
  {
    id: 'blue-cash-preferred',
    issuer: 'American Express',
    name: 'Blue Cash Preferred',
    currency: 'cash',
    annualFeeUsd: 95,
    baseRate: 1,
    earnRules: [
      { categories: ['groceries'], rate: 6, annualCapUsd: 6_000, note: '6% U.S. supermarkets, first $6k/yr' },
      { categories: ['streaming'], rate: 6, note: '6% select streaming' },
      { categories: ['travel_ground'], rate: 3, note: '3% transit and rideshare' },
      { categories: ['gas_ev'], rate: 3, note: '3% U.S. gas' },
    ],
    welcomeBonus: { amount: 250, minSpendUsd: 3_000, withinMonths: 6 },
    angle: '6% groceries and streaming — best for household spend.',
    applyUrl: 'https://www.americanexpress.com/us/credit-cards/card/blue-cash-preferred/',
    accountMatch: /blue\s*cash\s*preferred/i,
    verifiedAt: '2026-07-20',
  },
  {
    id: 'blue-cash-everyday',
    issuer: 'American Express',
    name: 'Blue Cash Everyday',
    currency: 'cash',
    annualFeeUsd: 0,
    baseRate: 1,
    earnRules: [
      { categories: ['groceries'], rate: 3, annualCapUsd: 6_000, note: '3% U.S. supermarkets, first $6k/yr' },
      { categories: ['gas_ev'], rate: 3, annualCapUsd: 6_000, note: '3% U.S. gas, first $6k/yr' },
    ],
    welcomeBonus: { amount: 200, minSpendUsd: 2_000, withinMonths: 6 },
    angle: 'No-fee 3% on groceries and gas.',
    applyUrl: 'https://www.americanexpress.com/us/credit-cards/card/blue-cash-everyday/',
    accountMatch: /blue\s*cash\s*everyday/i,
    verifiedAt: '2026-07-20',
  },
  {
    id: 'citi-double-cash',
    issuer: 'Citi',
    name: 'Double Cash',
    currency: 'cash',
    annualFeeUsd: 0,
    baseRate: 2,
    earnRules: [],
    welcomeBonus: { amount: 200, minSpendUsd: 1_500, withinMonths: 6 },
    angle: '2% on everything, no fee.',
    applyUrl: 'https://www.citi.com/credit-cards/citi-double-cash-credit-card',
    accountMatch: /double\s*cash/i,
    verifiedAt: '2026-07-20',
  },
  {
    id: 'capital-one-savor-one',
    issuer: 'Capital One',
    name: 'SavorOne',
    currency: 'cash',
    annualFeeUsd: 0,
    baseRate: 1,
    earnRules: [
      { categories: ['restaurants'], rate: 3, note: '3% dining' },
      { categories: ['entertainment'], rate: 3, note: '3% entertainment' },
      { categories: ['streaming'], rate: 3, note: '3% streaming' },
      { categories: ['groceries'], rate: 3, note: '3% groceries (not superstores)' },
    ],
    welcomeBonus: { amount: 200, minSpendUsd: 500, withinMonths: 3 },
    angle: 'No-fee 3% on dining, groceries, streaming and entertainment.',
    applyUrl: 'https://www.capitalone.com/credit-cards/savorone-dining-rewards/',
    accountMatch: /savor\s*one|savorone|\bsavor\b/i,
    verifiedAt: '2026-07-20',
  },
  {
    id: 'capital-one-venture',
    issuer: 'Capital One',
    name: 'Venture',
    currency: 'c1',
    annualFeeUsd: 95,
    baseRate: 2,
    earnRules: [{ categories: ['travel_hotel'], rate: 5, note: '5x hotels via Capital One Travel' }],
    welcomeBonus: { amount: 75_000, minSpendUsd: 4_000, withinMonths: 3 },
    angle: 'Flat 2x miles, best redeemed against travel.',
    applyUrl: 'https://www.capitalone.com/credit-cards/venture/',
    // Checked after Venture X, so "Venture X" never lands here.
    accountMatch: /venture(?!\s*x)/i,
    verifiedAt: '2026-07-20',
  },
  {
    id: 'capital-one-venture-x',
    issuer: 'Capital One',
    name: 'Venture X',
    currency: 'c1',
    annualFeeUsd: 395,
    baseRate: 2,
    earnRules: [
      { categories: ['travel_hotel'], rate: 10, note: '10x hotels via Capital One Travel' },
      { categories: ['travel_air'], rate: 5, note: '5x flights via Capital One Travel' },
    ],
    welcomeBonus: { amount: 75_000, minSpendUsd: 4_000, withinMonths: 3 },
    angle: 'Premium travel card with a 2x floor.',
    applyUrl: 'https://www.capitalone.com/credit-cards/venture-x/',
    accountMatch: /venture\s*x/i,
    verifiedAt: '2026-07-20',
  },
  {
    id: 'wf-active-cash',
    issuer: 'Wells Fargo',
    name: 'Active Cash',
    currency: 'cash',
    annualFeeUsd: 0,
    baseRate: 2,
    earnRules: [],
    welcomeBonus: { amount: 200, minSpendUsd: 500, withinMonths: 3 },
    angle: 'Flat 2% on everything, no fee.',
    applyUrl: 'https://www.wellsfargo.com/credit-cards/active-cash/',
    accountMatch: /active\s*cash/i,
    verifiedAt: '2026-07-20',
  },
];

/**
 * What an account earns when it is not a card the catalog knows. A credit card
 * with an unrecognised name is assumed to pay the common 1%; a checking account's
 * debit card pays nothing.
 */
export const GENERIC_CARDS: CatalogCard[] = [
  {
    id: 'generic-credit',
    issuer: 'Your',
    name: 'credit card',
    currency: 'cash',
    annualFeeUsd: 0,
    baseRate: 1,
    earnRules: [],
    angle: 'Any card the catalog does not recognise, assumed to pay 1%.',
    generic: true,
    verifiedAt: '2026-07-20',
  },
  {
    id: 'generic-debit',
    issuer: 'Your',
    name: 'debit card',
    currency: 'cash',
    annualFeeUsd: 0,
    baseRate: 0,
    earnRules: [],
    angle: 'Debit and bank transfers earn nothing.',
    generic: true,
    verifiedAt: '2026-07-20',
  },
];

export const CARD_BY_ID: Record<string, CatalogCard> = Object.fromEntries(
  [...CATALOG, ...GENERIC_CARDS].map((card) => [card.id, card]),
);

export function cardDisplayName(id: string): string {
  const card = CARD_BY_ID[id];
  return card ? `${card.issuer} ${card.name}` : id;
}

/**
 * The catalog card behind a bank account, read off the name Plaid reports for it
 * ("Chase Freedom Unlimited®", "Blue Cash Everyday® Card"). This is what spares
 * anyone from listing their cards by hand: linking the bank already named them.
 */
export function identifyCard(account: { name: string; officialName?: string | null; type: string }): string {
  const label = `${account.officialName ?? ''} ${account.name}`;
  // Venture X before Venture; otherwise catalog order.
  const ordered = [...CATALOG].sort((a, b) => Number(b.id === 'capital-one-venture-x') - Number(a.id === 'capital-one-venture-x'));
  const known = ordered.find((card) => card.accountMatch?.test(label));
  if (known) return known.id;
  return account.type === 'credit' ? 'generic-credit' : 'generic-debit';
}
