/**
 * Binds a pick to the resolved-market history in @/lib/calibration-data.
 *
 * The pure engine in @/lib/calibration knows nothing about routes or venues; this is
 * the layer that decides *which* cohort a given pick should be read against, and at
 * which venues that pick can actually be bought.
 *
 * On the three venues the app routes to:
 *
 *   Polymarket — the native venue for every prediction route the app generates, and
 *     the one whose own resolved history the reading comes from.
 *   Kalshi — offered when the same contract is confirmed cross-listed (see
 *     @/lib/market-comparison). Read against Kalshi's own history, because its
 *     markets and its fee schedule are not Polymarket's.
 *   Robinhood — sells event contracts but does not run an exchange for them; the
 *     contracts are Kalshi's, introduced through Robinhood's brokerage. So it reads
 *     Kalshi's table and says so, rather than implying a third body of evidence
 *     that does not exist.
 */
import {
  readCalibration,
  type CalibrationReading,
  type CalibrationVenue,
} from '@/lib/calibration';
import { CALIBRATION_CELLS } from '@/lib/calibration-data';
import { PREDICTION_TOPICS, isPredictionCategory, predictionTopic } from '@/lib/prediction-topics';
import type { MarketComparison } from '@/lib/market-comparison';
import type { Route } from '@/types/routes';

/**
 * Kalshi's half of the table is harvested but not yet shown, and this flag is the gate.
 *
 * Its numbers disagree with Polymarket's on the same kind of contract by more than
 * sampling noise allows: measured on the current table, 65–80¢ favourites resolved Yes
 * 79.0% of the time on Polymarket and 59.4% on Kalshi. Liquid sports moneylines on the
 * two venues price the same games within a cent or two of each other, so a twelve-point
 * gap in realised outcomes is a measurement fault on one side, not a real edge.
 *
 * The suspect is how a Kalshi price is read back. Polymarket serves a continuous daily
 * mid; Kalshi serves candlesticks whose last trade is absent on days without one, so the
 * harvest falls back to the closing bid/ask mid and the two sources are mixed. Its candle
 * series also stops at different points relative to the event — some markets' last candle
 * is the settlement print, others' is pre-game — so the "one day out" band is not reading
 * the same moment across markets.
 *
 * Until that is pinned down, a prediction pick reads Polymarket's history only, which is
 * also the venue every route the app generates actually lives on. Flip this to true once
 * the Kalshi curve agrees with Polymarket's on cross-listed sports.
 */
const KALSHI_READINGS_ENABLED = false;

/** Every topic the table can be keyed by, including markets that matched none. */
export const CALIBRATION_TOPICS: readonly string[] = [
  ...PREDICTION_TOPICS.map((topic) => topic.value),
  'other',
];

export interface VenueCalibration {
  venue: 'polymarket' | 'kalshi' | 'robinhood';
  label: string;
  /** Set when the venue fills through someone else's book, and the evidence is theirs. */
  routedVia?: string;
  reading: CalibrationReading;
}

/** The quoted price for a pick, 0–1, preferring the exact contract price over the rounded line. */
function routePrice(route: Route): number | null {
  if (route.entryPrice != null && route.entryPrice > 0 && route.entryPrice < 1) return route.entryPrice;
  if (route.probability > 0 && route.probability < 100) return route.probability / 100;
  return null;
}

function readFor(
  venue: CalibrationVenue,
  price: number,
  daysToResolution: number,
  route: Route,
): CalibrationReading | null {
  return readCalibration(CALIBRATION_CELLS, CALIBRATION_TOPICS, {
    venue,
    price,
    daysToResolution,
    topic: route.predictionTopic,
    topicLabel: predictionTopic(route.predictionTopic)?.label,
  });
}

/**
 * Readings for every venue this pick can be bought at, Polymarket first. Empty when the
 * route is not a prediction market, carries no usable price or resolution date, or when
 * no cohort in the table clears its minimum sample — all of which are ordinary, and none
 * of which should put a number on screen.
 */
export function routeCalibrations(
  route: Route,
  comparison: MarketComparison | null,
): VenueCalibration[] {
  if (!isPredictionCategory(route.category)) return [];
  const price = routePrice(route);
  const days = route.maturesInDays;
  if (price == null || days == null || days <= 0) return [];

  const out: VenueCalibration[] = [];
  const polymarket = readFor('polymarket', comparison?.polymarketRawPrice ?? price, days, route);
  if (polymarket) out.push({ venue: 'polymarket', label: 'Polymarket', reading: polymarket });

  // Kalshi and Robinhood are deliberately not read yet — see KALSHI_READINGS_ENABLED.
  if (KALSHI_READINGS_ENABLED && comparison) {
    const kalshi = readFor('kalshi', comparison.kalshiRawPrice, days, route);
    if (kalshi) {
      out.push({ venue: 'kalshi', label: 'Kalshi', reading: kalshi });
      out.push({
        venue: 'robinhood',
        label: 'Robinhood',
        routedVia: 'Kalshi',
        reading: kalshi,
      });
    }
  }
  return out;
}

/** The reading to headline: the venue the app would actually send this trade to. */
export function primaryCalibration(
  calibrations: readonly VenueCalibration[],
  destination: string | undefined,
): VenueCalibration | null {
  if (calibrations.length === 0) return null;
  return calibrations.find((entry) => entry.venue === destination) ?? calibrations[0];
}

export function __selfCheck(): void {
  const prediction: Route = {
    id: 'pm-live-1', category: 'Polymarket', emoji: '🎯', description: 'x', riskLevel: 3,
    probability: 91, expectedReturn: 10, platform: 'Polymarket', strategy: 's',
    entryPrice: 0.91, maturesInDays: 1, lossProfile: 'binary', meetsTarget: true,
    predictionTopic: 'sports',
  };
  const stock: Route = { ...prediction, category: 'Stocks & ETFs', entryPrice: undefined };

  console.assert(routeCalibrations(stock, null).length === 0,
    'a stock has no prediction-market track record to read');
  console.assert(routeCalibrations({ ...prediction, maturesInDays: undefined }, null).length === 0,
    'no resolution date means no lead band, so nothing is reported');
  console.assert(routeCalibrations({ ...prediction, entryPrice: undefined, probability: 0 }, null).length === 0,
    'a pick with no usable price is not bucketed');

  console.assert(CALIBRATION_TOPICS.includes('other'),
    'markets that matched no topic still have a bucket to aggregate into');
  console.assert(CALIBRATION_TOPICS.length === PREDICTION_TOPICS.length + 1,
    'the topic list is exactly the app topics plus "other"');

  const readings = routeCalibrations(prediction, null);
  console.assert(readings.every((entry) => entry.venue === 'polymarket'),
    'without a confirmed cross-listing only the native venue is reported');

  const withKalshi = routeCalibrations(prediction, {
    kalshiTicker: 'K', kalshiEventTicker: 'E', kalshiSeriesTicker: 'S',
    polymarketPrice: 0.91, kalshiPrice: 0.92, polymarketRawPrice: 0.91, kalshiRawPrice: 0.91,
    betterPlatform: 'polymarket', edgeCents: 1,
  });
  if (withKalshi.length > 0) {
    const robinhood = withKalshi.find((entry) => entry.venue === 'robinhood');
    console.assert(robinhood?.routedVia === 'Kalshi',
      'Robinhood must name the exchange whose history it is quoting');
    console.assert(withKalshi[0].venue === 'polymarket', 'the native venue leads the list');
  }

  console.assert(primaryCalibration([], 'polymarket') === null, 'no readings headline nothing');
}
