/**
 * User-facing app settings (Settings tab).
 *
 * Stored as one JSON blob under a single AsyncStorage key so adding a setting
 * never needs a new key or a migration: unknown fields are dropped and missing
 * fields fall back to DEFAULT_PREFERENCES on read.
 *
 * Pure module — no storage or React imports, so both the client layer and the
 * notification helpers can depend on it without a cycle.
 */

import type { AcquisitionPlatform } from '@/types/bets';

export interface CurrencyMeta {
  code: string;
  symbol: string;
  label: string;
  decimals: number;
}

/**
 * Display currencies. Every price the app receives is quoted in USD and is NOT
 * converted — this only changes the symbol and decimal convention used when
 * rendering, which is why the Settings row says so out loud.
 */
export const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'US Dollar', decimals: 2 },
  { code: 'EUR', symbol: '€', label: 'Euro', decimals: 2 },
  { code: 'GBP', symbol: '£', label: 'British Pound', decimals: 2 },
  { code: 'CAD', symbol: 'CA$', label: 'Canadian Dollar', decimals: 2 },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar', decimals: 2 },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen', decimals: 0 },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee', decimals: 2 },
] as const satisfies readonly CurrencyMeta[];

export type CurrencyCode = (typeof CURRENCIES)[number]['code'];

/**
 * The marketplaces a route can be placed on. Asked once in Settings rather than on
 * every search — where you can trade is a standing fact about you, not part of a goal.
 */
export const ACQUISITION_PLATFORMS = [
  { value: 'robinhood', label: 'Robinhood', icon: '🪶', description: 'Stocks, ETFs, crypto & predictions' },
  { value: 'polymarket', label: 'Polymarket', icon: '🔮', description: 'Prediction markets' },
  { value: 'kalshi', label: 'Kalshi', icon: '📊', description: 'Prediction markets' },
] as const satisfies readonly { value: AcquisitionPlatform; label: string; icon: string; description: string }[];

export interface Preferences {
  /** Symbol + decimals used to render money. Display only, never a conversion. */
  currency: CurrencyCode;
  /** Apps the user can trade on — routes are steered to these every time they search. */
  preferredPlatforms: AcquisitionPlatform[];
  /** "Goal hit — sell now" and goal-reached pushes. */
  positionAlerts: boolean;
  /** Sunday-evening nudge to check fresh routes. */
  weeklyReminder: boolean;
  /** Portfolio math assumes stocks/crypto return 0 instead of their expected value. */
  conservativeProjections: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  currency: 'USD',
  // Everything on by default: a new user should get results before they ever open Settings.
  preferredPlatforms: ACQUISITION_PLATFORMS.map((platform) => platform.value),
  positionAlerts: true,
  weeklyReminder: true,
  conservativeProjections: false,
};

export function currencyMeta(code: string): CurrencyMeta {
  return CURRENCIES.find((entry) => entry.code === code) ?? CURRENCIES[0];
}

/** Coerce whatever is on disk into a complete, valid Preferences object. */
export function sanitizePreferences(value: unknown): Preferences {
  if (typeof value !== 'object' || value === null) return DEFAULT_PREFERENCES;
  const raw = value as Record<string, unknown>;
  const bool = (key: keyof Preferences): boolean =>
    typeof raw[key] === 'boolean' ? (raw[key] as boolean) : (DEFAULT_PREFERENCES[key] as boolean);
  // An empty list is a legitimate answer ("no preference"), so only fall back when the
  // field is missing or isn't an array at all.
  const platforms = Array.isArray(raw.preferredPlatforms)
    ? ACQUISITION_PLATFORMS.map((platform) => platform.value).filter((value) =>
        (raw.preferredPlatforms as unknown[]).includes(value))
    : DEFAULT_PREFERENCES.preferredPlatforms;

  return {
    currency: CURRENCIES.some((entry) => entry.code === raw.currency)
      ? (raw.currency as CurrencyCode)
      : DEFAULT_PREFERENCES.currency,
    preferredPlatforms: platforms,
    positionAlerts: bool('positionAlerts'),
    weeklyReminder: bool('weeklyReminder'),
    conservativeProjections: bool('conservativeProjections'),
  };
}

export interface MoneyOptions {
  /** Override the currency's own decimal count (e.g. 0 for compact totals). */
  decimals?: number;
  /** Always show + or −, for gains and losses. */
  signed?: boolean;
}

/**
 * Render an amount in the user's display currency. Uses toLocaleString for
 * grouping (already relied on across the app) rather than Intl currency
 * formatting, which is not dependable across Hermes builds.
 */
export function formatMoney(amount: number, currency: string, options: MoneyOptions = {}): string {
  const meta = currencyMeta(currency);
  const decimals = options.decimals ?? meta.decimals;
  const safe = Number.isFinite(amount) ? amount : 0;
  const body = Math.abs(safe).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const sign = safe < 0 ? '−' : options.signed ? '+' : '';
  return `${sign}${meta.symbol}${body}`;
}
