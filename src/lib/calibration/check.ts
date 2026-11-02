import {
  cellKey,
  leadBucketFor,
  priceBucketIndex,
  readCalibration,
  resolveCohort,
  wilsonInterval,
  type CalibrationCell,
} from '@/lib/calibration/reading';

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
