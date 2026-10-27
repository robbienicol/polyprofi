/// <reference types="node" />
/**
 * Builds the resolved-market calibration table read by @/lib/calibration.
 *
 * Run it with `npm run build:calibration`. It is deliberately a build step and not a
 * runtime fetch: a single cohort needs hundreds of settled markets and one price-history
 * request per market, which is minutes of traffic — not something a pick-details screen
 * can do while somebody waits. The output is a few kilobytes of counts, so the app ships
 * it and looks up synchronously, offline included.
 *
 * What it harvests, per venue:
 *   Polymarket — closed Gamma markets, walked in monthly end-date windows because the
 *     offset parameter caps out around 2,000 per query. Outcome comes from outcomePrices
 *     settling to exactly 1/0; anything else is an unresolved or void market and is dropped.
 *   Kalshi — settled markets per series (the general settled feed is ~99% zero-volume
 *     multivariate parlays, so it is unusable). Outcome comes from the `result` field.
 *
 * Two sampling rules matter more than anything else here:
 *
 *   Per-series cap. Kalshi runs hourly crypto and weather series that settle thousands of
 *     markets a month. Left uncapped they would swamp the table and it would describe
 *     hourly bitcoin, not prediction markets. Each series contributes at most
 *     MAX_MARKETS_PER_SERIES.
 *   One observation per market per lead band. We sample the price at ~1, ~7 and ~30 days
 *     before resolution and never more than once per band, so the counts the app reports
 *     an interval from are independent within the cell they land in.
 */
import { writeFileSync } from 'node:fs';

import { cached, loadProgress } from './calibration/io';
import { harvestKalshiMarkets, kalshiObservations } from './calibration/kalshi';
import { aggregate, render } from './calibration/output';
import { harvestPolymarketMarkets, polymarketObservations } from './calibration/polymarket';
import { SMOKE } from './calibration/config';

const OUTPUT = 'src/lib/calibration-data.ts';

async function main(): Promise<void> {
  console.log(SMOKE ? 'Building calibration table (smoke run)…' : 'Building calibration table…');

  const progress = loadProgress();
  if (progress.size > 0) console.log(`Resuming: ${progress.size} markets already harvested`);

  console.log('Polymarket: harvesting resolved markets');
  const polyMarkets = await cached('polymarket-markets', harvestPolymarketMarkets)();
  console.log(`Polymarket: ${polyMarkets.length} resolved markets, fetching price history`);
  const polyObservations = await polymarketObservations(polyMarkets, progress);
  console.log(`Polymarket: ${polyObservations.length} observations`);

  console.log('Kalshi: sweeping series for settled markets');
  const kalshiMarkets = await cached('kalshi-markets', harvestKalshiMarkets)();
  console.log(`Kalshi: ${kalshiMarkets.length} settled markets, fetching candlesticks`);
  const kalshiObs = await kalshiObservations(kalshiMarkets, progress);
  console.log(`Kalshi: ${kalshiObs.length} observations`);

  const cells = aggregate([...polyObservations, ...kalshiObs]);
  writeFileSync(OUTPUT, render(cells, { polymarket: polyMarkets.length, kalshi: kalshiMarkets.length }));
  console.log(`Wrote ${OUTPUT}: ${Object.keys(cells).length} cells`);
}

void main();
