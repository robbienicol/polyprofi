import type { CardCategory } from '@/lib/card-rewards/types';

/**
 * Plaid's personal-finance category → the card-bonus category it earns under, or
 * null for money that never goes on a card: transfers, card payments, loans, rent,
 * income, fees. Excluding those is what keeps a checking account from reading as
 * "$1,800 a month of debit spend you could be earning 2% on" when $1,500 of it is
 * rent and the credit-card bill.
 *
 * Streaming is matched by merchant first, because Plaid files Netflix and a
 * cinema ticket under the same TV-and-movies bucket and only one of them earns a
 * streaming bonus.
 */
const STREAMING = /netflix|hulu|spotify|disney\s*\+?|disney\s*plus|\bmax\b|hbo|youtube\s*(premium|tv)|peacock|paramount|apple\s*(tv|music)|sirius|pandora|tidal|crunchyroll|audible/i;
const SUPERSTORE = /walmart|target|costco|sam'?s\s*club|bj'?s\s*wholesale/i;

const BY_DETAILED: Record<string, CardCategory | null> = {
  FOOD_AND_DRINK_GROCERIES: 'groceries',
  FOOD_AND_DRINK_RESTAURANT: 'restaurants',
  FOOD_AND_DRINK_FAST_FOOD: 'restaurants',
  FOOD_AND_DRINK_COFFEE: 'restaurants',
  TRANSPORTATION_GAS: 'gas_ev',
  TRANSPORTATION_TAXIS_AND_RIDE_SHARES: 'travel_ground',
  TRANSPORTATION_PUBLIC_TRANSIT: 'travel_ground',
  TRANSPORTATION_PARKING: 'travel_ground',
  TRANSPORTATION_TOLLS: 'travel_ground',
  TRAVEL_FLIGHTS: 'travel_air',
  TRAVEL_LODGING: 'travel_hotel',
  TRAVEL_RENTAL_CARS: 'travel_hotel',
  ENTERTAINMENT_TV_AND_MOVIES: 'entertainment',
  ENTERTAINMENT_MUSIC_AND_AUDIO: 'entertainment',
  ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS: 'entertainment',
  // A card treats gambling as a cash advance: fees, no rewards.
  ENTERTAINMENT_CASINOS_AND_GAMBLING: null,
  MEDICAL_PHARMACIES_AND_SUPPLEMENTS: 'drugstores',
  RENT_AND_UTILITIES_TELEPHONE: 'telecom',
  RENT_AND_UTILITIES_INTERNET_AND_CABLE: 'telecom',
  RENT_AND_UTILITIES_GAS_AND_ELECTRICITY: 'utilities',
  RENT_AND_UTILITIES_WATER: 'utilities',
  RENT_AND_UTILITIES_RENT: null,
  GENERAL_MERCHANDISE_OFFICE_SUPPLIES: 'office_supplies',
  // Card grocery bonuses exclude superstores and warehouse clubs.
  GENERAL_MERCHANDISE_SUPERSTORES: 'other',
};

/** Whole primaries that are never card spend. */
const NOT_SPEND = new Set([
  'INCOME',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'LOAN_PAYMENTS',
  'BANK_FEES',
  'GOVERNMENT_AND_NON_PROFIT',
]);

export interface PlaidCategoryInput {
  merchant: string;
  primary?: string | null;
  detailed?: string | null;
}

export function cardCategoryFor({ merchant, primary, detailed }: PlaidCategoryInput): CardCategory | null {
  if (primary && NOT_SPEND.has(primary)) return null;
  if (STREAMING.test(merchant)) return 'streaming';
  if (detailed && detailed in BY_DETAILED) {
    const mapped = BY_DETAILED[detailed];
    if (mapped === 'groceries' && SUPERSTORE.test(merchant)) return 'other';
    return mapped;
  }
  return 'other';
}

export function __selfCheck(): void {
  const check = (condition: boolean, message: string) => {
    if (!condition) throw new Error(`[plaid-categories] ${message}`);
  };
  check(cardCategoryFor({ merchant: 'Shell', primary: 'TRANSPORTATION', detailed: 'TRANSPORTATION_GAS' }) === 'gas_ev', 'gas is gas');
  check(cardCategoryFor({ merchant: 'Netflix', primary: 'ENTERTAINMENT', detailed: 'ENTERTAINMENT_TV_AND_MOVIES' }) === 'streaming', 'Netflix is streaming');
  check(cardCategoryFor({ merchant: 'AMC Theatres', primary: 'ENTERTAINMENT', detailed: 'ENTERTAINMENT_TV_AND_MOVIES' }) === 'entertainment', 'a cinema is not streaming');
  check(cardCategoryFor({ merchant: 'Chase Credit Crd Autopay', primary: 'LOAN_PAYMENTS', detailed: 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT' }) === null, 'paying the card bill is not spend');
  check(cardCategoryFor({ merchant: 'Rent', primary: 'RENT_AND_UTILITIES', detailed: 'RENT_AND_UTILITIES_RENT' }) === null, 'rent is not card spend');
  check(cardCategoryFor({ merchant: 'Walmart', primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_GROCERIES' }) === 'other', 'Walmart groceries earn no grocery bonus');
}
