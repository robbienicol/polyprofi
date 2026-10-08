/**
 * Card-rewards domain types, ported from Basel (trybasel/src/lib/types.ts) and cut
 * down to the consumer side: the spend categories a card bonus can attach to, and
 * the shape of a card's earn rules.
 */

export type CardCategory =
  | 'restaurants'
  | 'groceries'
  | 'gas_ev'
  | 'streaming'
  | 'entertainment'
  | 'drugstores'
  | 'travel_air'
  | 'travel_hotel'
  | 'travel_ground'
  | 'telecom'
  | 'utilities'
  | 'office_supplies'
  | 'other';

export const CARD_CATEGORY_LABELS: Record<CardCategory, string> = {
  restaurants: 'dining',
  groceries: 'groceries',
  gas_ev: 'gas',
  streaming: 'streaming',
  entertainment: 'entertainment',
  drugstores: 'drugstores',
  travel_air: 'flights',
  travel_hotel: 'hotels',
  travel_ground: 'rideshare & transit',
  telecom: 'phone & internet',
  utilities: 'utilities',
  office_supplies: 'office supplies',
  other: 'everyday purchases',
};

export type RewardCurrency = 'cash' | 'ur' | 'mr' | 'c1';

export interface EarnRule {
  categories: CardCategory[];
  /** Multiplier: 3 means 3x points, or 3% when the currency is cash. */
  rate: number;
  /** Annual spend cap across the rule's categories; spend past it earns the base rate. */
  annualCapUsd?: number;
  note?: string;
}

export interface WelcomeBonus {
  /** Dollars for a cash card, points for a points card. */
  amount: number;
  minSpendUsd: number;
  /** Months after approval the minimum spend has to be met in. */
  withinMonths: number;
}

export interface CatalogCard {
  id: string;
  issuer: string;
  name: string;
  currency: RewardCurrency;
  annualFeeUsd: number;
  baseRate: number;
  earnRules: EarnRule[];
  welcomeBonus?: WelcomeBonus;
  /** A first-year boost on everything, as Freedom Unlimited's extra 1.5% on the first $20k. */
  firstYearExtra?: { rate: number; capUsd: number };
  /** One sentence on why someone holds it. */
  angle: string;
  applyUrl?: string;
  /** Matches the product in a bank account's name as Plaid reports it. */
  accountMatch?: RegExp;
  /** Stand-in for a card the catalog does not know. Never recommended. */
  generic?: boolean;
  verifiedAt: string;
}

export interface CategorySpend {
  category: CardCategory;
  /** Annualized dollars. */
  totalUsd: number;
}

export interface WalletResult {
  cardIds: string[];
  /** category → card it is routed to */
  assignment: Partial<Record<CardCategory, string>>;
  /** Annual reward dollars earned per category. */
  earnedByCategory: Partial<Record<CardCategory, number>>;
  grossRewardsUsd: number;
  annualFeesUsd: number;
  netRewardsUsd: number;
}
