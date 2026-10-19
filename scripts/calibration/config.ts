/// <reference types="node" />
/** Settings and shapes shared by every step of scripts/build-calibration.ts. */
import type { CalibrationVenue, LeadBucket } from '@/lib/calibration';

export const UA = { Accept: 'application/json', 'User-Agent': 'pathey-calibration/1.0' };
export const DAY_MS = 86_400_000;

/**
 * Scratch directory for a resumable harvest. A full sweep is tens of thousands of
 * requests over the better part of an hour, and losing all of it to a closed laptop
 * makes the table something nobody refreshes. Market lists are cached for the day and
 * per-market results are appended as they land, so a re-run picks up where it stopped
 * and costs only the batch that was in flight.
 */
export const CACHE_DIR = '.calibration-cache';

export const RESET = process.argv.includes('--reset');
export const SMOKE = process.argv.includes('--smoke');
export const PROGRESS_FILE = `${CACHE_DIR}/observations${SMOKE ? '-smoke' : ''}.ndjson`;

/** How far before a market stopped trading each band reads its price. */
export const LEAD_TARGETS: Record<LeadBucket, { days: number }> = {
  closing: { days: 1 },
  week: { days: 7 },
  long: { days: 30 },
};

/** Fees are charged per contract and scale with size; 100 matches @/lib/market-comparison. */
export const CONTRACTS_FOR_FEE_ESTIMATE = 100;

export const MONTHS_BACK = 24;
export const MAX_MARKETS_PER_SERIES = 30;
/**
 * Liquidity floors, kept low deliberately. A floor is itself a mild selection: a cheap
 * contract that comes in attracts volume, one that quietly expires does not, so a high
 * floor keeps the surprising winners and drops the boring losers. These sit at the same
 * liquidity the app will actually route somebody to, and no higher.
 */
export const MIN_KALSHI_VOLUME = 1_000;
export const MIN_POLYMARKET_VOLUME = 1_000;
export const POLYMARKET_TARGET = 6_000;
export const KALSHI_TARGET = 4_500;

/** One market's contribution, keyed so a resumed run knows to skip it. */
export interface MarketResult {
  key: string;
  observations: Observation[];
}

export interface Observation {
  venue: CalibrationVenue;
  topic: string;
  lead: LeadBucket;
  bucket: number;
  /** Price at the sampled lead time, 0–1. */
  price: number;
  yes: boolean;
}
