/**
 * What actually happened to markets that were priced like this one.
 *
 * A prediction-market price *is* a probability: 91¢ says "91% likely". That claim is
 * checkable in a way a stock price never is, because every market ends in a settled
 * yes or no on a known date. So we harvest resolved markets, record the price they
 * traded at some days before they settled, and count how often the Yes side actually
 * won. Two readings come out of the same table:
 *
 *   Calibration — markets priced near 91¢ resolved Yes 84% of the time, so the price
 *                 is running ahead of the outcome (the favourite–longshot bias).
 *   Track record — staking the same amount on every one of them returned −7% per
 *                 market after fees.
 *
 * The counts live in the generated `calibration-data` module; everything here is the
 * lookup and the arithmetic, so both are testable without a network.
 *
 * Three rules keep this honest, and none of them are optional:
 *
 *  1. One observation per market per lead-time band. Sampling a market's price daily
 *     would multiply `n` without adding independent evidence, and the interval below
 *     would then be far tighter than the evidence deserves.
 *  2. Never report a cell thinner than MIN_CELL_SAMPLE. We widen the cohort instead —
 *     pooling topics, then venues, but never lead bands, for the reason in rule 1 — and
 *     name the cohort on screen rather than quoting a rate off nine markets.
 *  3. Only call a price wrong when the 95% interval excludes it. Anything else reads
 *     as in line, however tempting the point estimate looks.
 */

export type CalibrationVenue = 'polymarket' | 'kalshi';

/**
 * Price-bucket edges in cents, closed on the left. Deliberately finer at the
 * extremes: that is where the favourite–longshot bias lives, and where a bucket
 * spanning 20 points would average the effect away to nothing.
 */
export const PRICE_BUCKET_EDGES = [2, 5, 10, 20, 35, 50, 65, 80, 90, 95, 98] as const;

/** How close to resolution the price was sampled. */
export type LeadBucket = 'closing' | 'week' | 'long';
export const LEAD_BUCKETS: readonly LeadBucket[] = ['closing', 'week', 'long'];

const LEAD_LABELS: Record<LeadBucket, string> = {
  closing: 'inside 2 days of resolving',
  week: '3–14 days from resolving',
  long: 'more than 2 weeks out',
};

/**
 * Below this, a cohort is widened rather than reported. Set high on purpose: at 30 the
 * table was willing to tell somebody a contract "almost never happens" off 32 markets,
 * which is a strong claim from a weak sample.
 */
export const MIN_CELL_SAMPLE = 100;

/**
 * The two verdicts are not symmetric, and deliberately so.
 *
 * Telling somebody they are paying over the odds costs them a bet they do not place.
 * Telling them a contract looks underpriced costs them money if we are wrong, and it is
 * the one line on this card a reader can mistake for a tip. So "cheap" has to clear a
 * materially higher bar: more markets behind it, and the interval clear of the price by
 * a real margin rather than by a hair.
 *
 * The practical effect is that efficient markets — sports moneylines above all — settle
 * on "in line" rather than flickering between verdicts on sampling noise, without any
 * need to special-case a category.
 */
const CHEAP_MIN_SAMPLE = 250;
const CHEAP_MIN_MARGIN_PTS = 3;

/** 95% two-sided normal quantile, for the Wilson interval. */
const Z = 1.96;

/**
 * [observations, resolved Yes, summed entry price, summed gross payout, summed net payout]
 * — every field a plain sum, so cells combine into a wider cohort by adding them.
 *
 * The two payout sums are what make the return exact rather than an estimate. Staking
 * the same amount on each market buys 1/price contracts, so a winner returns 1/price and
 * a loser returns nothing: the sums carry Σ(1/price) over the winners, before and after
 * the venue's fee. Dividing by n gives the real average. Deriving it instead from the
 * cohort's hit rate over its mean price would be an average of ratios read as a ratio of
 * averages, which is a different — and always flattering at the extremes — number.
 */
export type CalibrationCell = readonly [
  n: number,
  yes: number,
  priceSum: number,
  grossWinPayoutSum: number,
  netWinPayoutSum: number,
];

export interface CalibrationCohort {
  n: number;
  yes: number;
  /** Mean entry price across the cohort, 0–1. */
  meanPrice: number;
  /** Mean value returned per $1 staked, before and after fees. 1.0 is breaking even. */
  grossPayoutPerStake: number;
  netPayoutPerStake: number;
  /** How far we had to widen to clear MIN_CELL_SAMPLE. */
  breadth: 'topic' | 'venue' | 'all_venues';
}

export interface CalibrationReading {
  venue: CalibrationVenue;
  /** The price this pick is actually offered at, in cents. */
  priceCents: number;
  /** How often the cohort resolved Yes, in percent. */
  hitRatePct: number;
  /** 95% Wilson interval on that rate, in percent. */
  intervalPct: readonly [number, number];
  sampleSize: number;
  /** hitRatePct − priceCents. Positive means the outcome beat the price. */
  edgePts: number;
  /** Only ever 'rich' or 'cheap' when the interval excludes the price. */
  verdict: 'rich' | 'cheap' | 'in_line';
  /** Plain-English description of which markets were counted. */
  cohortLabel: string;
  breadth: CalibrationCohort['breadth'];
  /** Return from staking the same amount on every market in the cohort. */
  trackRecord: {
    meanPriceCents: number;
    grossReturnPct: number;
    /** After the venue's trading fee. This is the number that matters. */
    netReturnPct: number;
  };
}

export function priceBucketIndex(priceCents: number): number | null {
  if (!Number.isFinite(priceCents)) return null;
  for (let index = 0; index < PRICE_BUCKET_EDGES.length - 1; index++) {
    if (priceCents >= PRICE_BUCKET_EDGES[index] && priceCents < PRICE_BUCKET_EDGES[index + 1]) return index;
  }
  return null;
}

export function priceBucketLabel(index: number): string {
  return `${PRICE_BUCKET_EDGES[index]}–${PRICE_BUCKET_EDGES[index + 1]}¢`;
}

export function leadBucketFor(daysToResolution: number): LeadBucket {
  if (daysToResolution <= 2) return 'closing';
  if (daysToResolution <= 14) return 'week';
  return 'long';
}

export function cellKey(
  venue: CalibrationVenue | 'any',
  topic: string,
  lead: LeadBucket | 'any',
  bucket: number,
): string {
  return `${venue}|${topic}|${lead}|${bucket}`;
}

/**
 * Lower bound, upper bound of the Wilson score interval — chosen over the normal
 * approximation because these rates sit near 0 and 1, where the normal interval
 * runs past the ends of the scale and claims certainty it has not earned.
 */
export function wilsonInterval(yes: number, n: number, z = Z): readonly [number, number] {
  if (n <= 0) return [0, 1];
  const p = yes / n;
  const denominator = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denominator;
  const half = (z / denominator) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

function sumCells(cells: Record<string, CalibrationCell>, keys: string[]): CalibrationCell {
  let n = 0;
  let yes = 0;
  let priceSum = 0;
  let grossWin = 0;
  let netWin = 0;
  for (const key of keys) {
    const cell = cells[key];
    if (!cell) continue;
    n += cell[0];
    yes += cell[1];
    priceSum += cell[2];
    grossWin += cell[3];
    netWin += cell[4];
  }
  return [n, yes, priceSum, grossWin, netWin];
}

/**
 * Widens the cohort until it clears MIN_CELL_SAMPLE: topic first (a 90¢ sports market
 * and a 90¢ politics market are still both 90¢ markets), then the venue. Returns null
 * when even both venues pooled are too thin — better to show nothing than a rate off a
 * handful of markets.
 *
 * The one axis we never widen along is the lead band, and that is not a style choice.
 * A market is sampled once per band, so pooling two bands counts the same market twice
 * and the interval would tighten on evidence that was never independent. Price bucket
 * and lead band are therefore fixed; only topic and venue are pooled, and within any
 * cohort this builds, each market appears exactly once.
 */
export function resolveCohort(
  cells: Record<string, CalibrationCell>,
  topics: readonly string[],
  venue: CalibrationVenue,
  topic: string | undefined,
  lead: LeadBucket,
  bucket: number,
): CalibrationCohort | null {
  const ladder: { breadth: CalibrationCohort['breadth']; keys: string[] }[] = [];
  if (topic) ladder.push({ breadth: 'topic', keys: [cellKey(venue, topic, lead, bucket)] });
  ladder.push({ breadth: 'venue', keys: topics.map((each) => cellKey(venue, each, lead, bucket)) });
  ladder.push({
    breadth: 'all_venues',
    keys: (['polymarket', 'kalshi'] as const)
      .flatMap((each) => topics.map((name) => cellKey(each, name, lead, bucket))),
  });

  for (const step of ladder) {
    const [n, yes, priceSum, grossWin, netWin] = sumCells(cells, step.keys);
    if (n >= MIN_CELL_SAMPLE) {
      return {
        n,
        yes,
        meanPrice: priceSum / n,
        grossPayoutPerStake: grossWin / n,
        netPayoutPerStake: netWin / n,
        breadth: step.breadth,
      };
    }
  }
  return null;
}

/**
 * A descriptor, not a sentence — venue, topic, price band, lead band, joined by dots.
 * Callers put it after their own lead-in, so it must not assume it starts one: an
 * earlier version lowercased its first letter to fit and produced "settled polymarket
 * markets", which is a proper noun the copy has no business editing.
 */
function cohortLabel(
  breadth: CalibrationCohort['breadth'],
  venue: CalibrationVenue,
  topicLabel: string | undefined,
  lead: LeadBucket,
  bucket: number,
): string {
  const venueName = venue === 'kalshi' ? 'Kalshi' : 'Polymarket';
  const parts = [
    breadth === 'all_venues' ? 'Polymarket & Kalshi' : venueName,
    breadth === 'topic' ? topicLabel : undefined,
    priceBucketLabel(bucket),
    LEAD_LABELS[lead],
  ];
  return parts.filter(Boolean).join(' · ');
}

export interface CalibrationInput {
  venue: CalibrationVenue;
  /** Contract price, 0–1. */
  price: number;
  daysToResolution: number;
  /** Coarse topic slug from @/lib/prediction-topics. Absent is fine — the cohort widens. */
  topic?: string;
  topicLabel?: string;
}

export function readCalibration(
  cells: Record<string, CalibrationCell>,
  topics: readonly string[],
  input: CalibrationInput,
): CalibrationReading | null {
  const priceCents = input.price * 100;
  const bucket = priceBucketIndex(priceCents);
  if (bucket == null) return null;
  const lead = leadBucketFor(input.daysToResolution);
  const cohort = resolveCohort(cells, topics, input.venue, input.topic, lead, bucket);
  if (!cohort) return null;

  const hitRate = cohort.yes / cohort.n;
  const [low, high] = wilsonInterval(cohort.yes, cohort.n);
  // The price is only "wrong" when the whole interval sits off it — a point estimate that
  // merely differs is the sampling noise you would expect. "Cheap" then has to clear the
  // extra bar above before it is allowed to say so.
  const cheapEnough = low > input.price + CHEAP_MIN_MARGIN_PTS / 100
    && cohort.n >= CHEAP_MIN_SAMPLE;
  const verdict = high < input.price ? 'rich' : cheapEnough ? 'cheap' : 'in_line';

  return {
    venue: input.venue,
    priceCents: Math.round(priceCents * 10) / 10,
    hitRatePct: hitRate * 100,
    intervalPct: [low * 100, high * 100],
    sampleSize: cohort.n,
    edgePts: hitRate * 100 - priceCents,
    verdict,
    cohortLabel: cohortLabel(cohort.breadth, input.venue, input.topicLabel, lead, bucket),
    breadth: cohort.breadth,
    trackRecord: {
      meanPriceCents: cohort.meanPrice * 100,
      grossReturnPct: (cohort.grossPayoutPerStake - 1) * 100,
      netReturnPct: (cohort.netPayoutPerStake - 1) * 100,
    },
  };
}

/** A cohort whose winners return exactly the total staked must read as 0%. */
function fairPayout(): number {
  const even = readCalibration(
    { [cellKey('kalshi', 'sports', 'closing', 5)]: [100, 55, 55, 100, 100] },
    ['sports'],
    { venue: 'kalshi', price: 0.55, daysToResolution: 1, topic: 'sports' },
  );
  return Math.abs(even?.trackRecord.grossReturnPct ?? 99);
}

export function __selfCheck(): void {
  console.assert(priceBucketIndex(91) === 8, '91¢ falls in the 90–95¢ bucket');
  console.assert(priceBucketIndex(90) === 8, 'bucket edges are closed on the left');
  console.assert(priceBucketIndex(95) === 9, '95¢ opens the next bucket, it does not close the last');
  console.assert(priceBucketIndex(1) === null, 'below 2¢ is outside every bucket we report on');
  console.assert(priceBucketIndex(99) === null, 'above 98¢ is outside every bucket we report on');
  console.assert(leadBucketFor(1) === 'closing' && leadBucketFor(9) === 'week' && leadBucketFor(60) === 'long',
    'lead bands split at 2 and 14 days');

  const [low, high] = wilsonInterval(84, 100);
  console.assert(low > 0.75 && high < 0.91, 'a 84/100 rate should land inside roughly 75–91%');
  console.assert(wilsonInterval(0, 10)[0] === 0, 'a zero rate cannot have a negative lower bound');
  console.assert(wilsonInterval(10, 10)[1] === 1, 'a perfect rate cannot exceed 1');
  console.assert(wilsonInterval(50, 1000)[1] - wilsonInterval(50, 1000)[0]
    < wilsonInterval(5, 100)[1] - wilsonInterval(5, 100)[0], 'more evidence must narrow the interval');

  const topics = ['sports', 'politics'];
  const thinTopic: Record<string, CalibrationCell> = {
    [cellKey('polymarket', 'sports', 'closing', 8)]: [40, 36, 36.4, 39.56, 39.56],
    [cellKey('polymarket', 'politics', 'closing', 8)]: [90, 77, 81.9, 84.6, 84.6],
  };
  const widened = resolveCohort(thinTopic, topics, 'polymarket', 'sports', 'closing', 8);
  console.assert(widened?.breadth === 'venue' && widened.n === 130,
    'a topic cell under the minimum widens to the venue rather than being reported');
  // The same market is sampled once per lead band, so a cohort must never span two.
  const otherBand: Record<string, CalibrationCell> = {
    ...thinTopic,
    [cellKey('polymarket', 'sports', 'week', 8)]: [500, 450, 455, 494.5, 494.5],
  };
  console.assert(resolveCohort(otherBand, topics, 'polymarket', 'sports', 'closing', 8)?.n === 130,
    'a fat neighbouring lead band must not be pooled into a thin one');
  console.assert(resolveCohort({}, topics, 'polymarket', 'sports', 'closing', 8) === null,
    'no evidence at any breadth reports nothing at all');

  const cells: Record<string, CalibrationCell> = {
    // 200 markets priced at an average of 91¢ that resolved Yes 84% of the time. Each
    // winner returned 1/0.91 = 1.0989, so 168 of them pay 184.62 back on a 200 stake.
    [cellKey('polymarket', 'sports', 'closing', 8)]: [200, 168, 182, 184.62, 184.62],
  };
  const reading = readCalibration(cells, topics, {
    venue: 'polymarket', price: 0.91, daysToResolution: 1, topic: 'sports', topicLabel: 'Sports',
  });
  console.assert(reading?.sampleSize === 200 && Math.round(reading.hitRatePct) === 84,
    'the reading reports the cohort it actually summed');
  console.assert(reading?.verdict === 'rich', '84% realised against a 91¢ price is dear beyond the interval');
  console.assert(reading != null && reading.edgePts < 0, 'a dear price shows a negative edge');
  console.assert(reading != null && Math.abs(reading.trackRecord.netReturnPct - -7.69) < 0.05,
    'paying 91¢ for an 84% outcome loses 7.7% a resolution, not the 7.7% a ratio of means would flatter');
  console.assert(fairPayout() <= 0.0001,
    'a cohort whose winners exactly repay the stake breaks even');

  const fair = readCalibration(
    { [cellKey('polymarket', 'sports', 'closing', 8)]: [200, 182, 182, 200, 199] },
    topics,
    { venue: 'polymarket', price: 0.91, daysToResolution: 1, topic: 'sports' },
  );
  console.assert(fair?.verdict === 'in_line', 'a rate that matches the price reads as in line');

  // Asymmetry: the same evidence that condemns a price must not be enough to recommend one.
  const thinUpside = readCalibration(
    { [cellKey('polymarket', 'sports', 'closing', 3)]: [150, 90, 37.5, 150, 150] },
    topics,
    { venue: 'polymarket', price: 0.25, daysToResolution: 1, topic: 'sports' },
  );
  console.assert(thinUpside?.verdict === 'in_line',
    '150 markets is enough to warn on a price but not enough to call one underpriced');
  const strongUpside = readCalibration(
    { [cellKey('polymarket', 'sports', 'closing', 3)]: [600, 360, 150, 600, 600] },
    topics,
    { venue: 'polymarket', price: 0.25, daysToResolution: 1, topic: 'sports' },
  );
  console.assert(strongUpside?.verdict === 'cheap',
    'the same edge over 600 markets does clear the bar');
  const hairline = readCalibration(
    { [cellKey('polymarket', 'sports', 'closing', 3)]: [600, 156, 150, 600, 600] },
    topics,
    { venue: 'polymarket', price: 0.25, daysToResolution: 1, topic: 'sports' },
  );
  console.assert(hairline?.verdict === 'in_line',
    'an edge inside the margin is not called underpriced however many markets back it');
}
