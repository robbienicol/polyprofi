/// <reference types="node" />
/** The harvest's plumbing: the resumable cache, a paced fetch, a worker pool and parsing helpers. */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { CACHE_DIR, PROGRESS_FILE, RESET, SMOKE, UA, type Observation, type MarketResult } from './config';

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
}

/** Day-scoped so a refresh a week later re-fetches rather than rebuilding stale lists. */
export function cached<T>(name: string, produce: () => Promise<T>): () => Promise<T> {
  return async () => {
    ensureCacheDir();
    // Namespaced by run size: a smoke run's deliberately truncated market list must
    // never be picked up by a full build later the same day.
    const path = `${CACHE_DIR}/${name}${SMOKE ? '-smoke' : ''}.json`;
    const today = new Date().toISOString().slice(0, 10);
    if (!RESET && existsSync(path)) {
      try {
        const parsed = JSON.parse(readFileSync(path, 'utf8')) as { day: string; value: T };
        if (parsed.day === today) {
          console.log(`  (reusing cached ${name})`);
          return parsed.value;
        }
      } catch {
        // A corrupt cache is not worth a failed build; fall through and re-fetch.
      }
    }
    const value = await produce();
    writeFileSync(path, JSON.stringify({ day: today, value }));
    return value;
  };
}

export function loadProgress(): Map<string, Observation[]> {
  const done = new Map<string, Observation[]>();
  if (RESET || !existsSync(PROGRESS_FILE)) return done;
  for (const line of readFileSync(PROGRESS_FILE, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as MarketResult;
      done.set(parsed.key, parsed.observations);
    } catch {
      // A half-written final line from a killed run. Skipping it re-fetches one market.
    }
  }
  return done;
}

export function recordProgress(key: string, observations: Observation[]): void {
  ensureCacheDir();
  appendFileSync(PROGRESS_FILE, `${JSON.stringify({ key, observations })}\n`);
}

/**
 * Minimum gap between request *starts*, per lane. Measured, not guessed: Kalshi's
 * markets and series endpoints happily serve 16 concurrent workers, but candlesticks
 * starts returning 429 at four — so the limiter has to be per endpoint rather than
 * per host, or the cheap sweep gets throttled to the speed of the expensive one.
 */
const LANE_MIN_INTERVAL_MS: Record<string, number> = {
  candlesticks: 150,
  polymarket: 30,
};

function laneFor(url: string): string | null {
  if (url.includes('/candlesticks')) return 'candlesticks';
  if (url.includes('polymarket.com')) return 'polymarket';
  return null;
}

const laneGate = new Map<string, Promise<void>>();

async function pace(url: string): Promise<void> {
  const lane = laneFor(url);
  const interval = lane ? LANE_MIN_INTERVAL_MS[lane] : 0;
  if (!lane || !interval) return;
  const previous = laneGate.get(lane) ?? Promise.resolve();
  let release: () => void = () => {};
  const mine = new Promise<void>((resolve) => { release = resolve; });
  laneGate.set(lane, previous.then(() => mine));
  await previous;
  setTimeout(release, interval);
}

export async function fetchJson(url: string, attempts = 6): Promise<unknown> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    await pace(url);
    try {
      const response = await fetch(url, { headers: UA });
      if (response.status === 429 || response.status >= 500) throw new Error(`status ${response.status}`);
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      if (attempt === attempts - 1) {
        console.warn(`  ! ${url.slice(0, 90)}: ${error instanceof Error ? error.message : String(error)}`);
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, 700 * 2 ** attempt));
    }
  }
  return null;
}

export async function pool<T, R>(items: T[], workers: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(workers, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results.push(await task(items[index]));
    }
  }));
  return results;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function numberOf(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
