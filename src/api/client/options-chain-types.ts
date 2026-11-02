/**
 * The trimmed option chains the server hands the device (see /api/options-chains).
 *
 * The raw CBOE file is 2–6 MB per ticker, so the server keeps only what the route
 * builder can use: for each goal horizon, the one expiry closest to it without going
 * past it, and only liquid contracts near the money on that expiry.
 */
export interface OptionContract {
  type: 'call' | 'put';
  strike: number;
  bid: number;
  ask: number;
  /** Annualised implied volatility as a fraction (0.26 = 26%). */
  iv: number;
  delta: number;
  openInterest: number;
}

export interface OptionExpiry {
  /** ISO date, e.g. "2026-10-16". */
  date: string;
  contracts: OptionContract[];
}

export interface OptionChain {
  symbol: string;
  /** Underlying last price from the same CBOE snapshot as the contracts. */
  price: number;
  /** Underlying ask — what 100 shares for a covered call actually cost. */
  ask: number;
  /** CBOE snapshot time (delayed ~15 minutes). */
  asOf: string;
  expiries: OptionExpiry[];
}
