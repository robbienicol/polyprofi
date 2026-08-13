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

export interface Preferences {
  /** Symbol + decimals used to render money. Display only, never a conversion. */
  currency: CurrencyCode;
  /** "Goal hit — sell now" and goal-reached pushes. */
  positionAlerts: boolean;
  /** Sunday-evening nudge to check fresh routes. */
  weeklyReminder: boolean;
  /** Portfolio math assumes stocks/crypto return 0 instead of their expected value. */
  conservativeProjections: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  currency: 'USD',
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
  return {
    currency: CURRENCIES.some((entry) => entry.code === raw.currency)
      ? (raw.currency as CurrencyCode)
      : DEFAULT_PREFERENCES.currency,
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
