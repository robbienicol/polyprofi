/// <reference types="node" />
import { LEAD_BUCKETS, priceBucketIndex, type CalibrationVenue, type LeadBucket } from '@/lib/calibration';

import { DAY_MS, LEAD_TARGETS, type Observation } from './config';

/**
 * The price this market was showing `days` before it stopped trading.
 *
 * Two decisions here are what keep the sample honest, and the first draft of this
 * function got both wrong in the same direction — flattering longshots by roughly
 * double.
 *
 * It anchors on the last point in the price series, not on the market's nominal end
 * date. Polymarket's endDate is a scheduled deadline, and a question that gets settled
 * early simply stops trading well before it. Measuring back from the scheduled date
 * would put the target after the series ended for exactly those markets, drop them, and
 * quietly delete every decisively-resolved question from the sample.
 *
 * And it carries the last known price forward rather than requiring a tick near the
 * target. A market nobody trades in its final week still has a price; dropping it for
 * want of a fresh tick throws away the dead longshots that resolve No, which are most
 * of the losing evidence. The only markets excluded from a band now are the ones that
 * genuinely did not exist that far back — an absence with no bias in it.
 */
function priceAtLead(
  series: { t: number; p: number }[],
  lead: LeadBucket,
): number | null {
  if (series.length === 0) return null;
  const ordered = [...series].sort((a, b) => a.t - b.t);
  const anchor = ordered[ordered.length - 1].t;
  const targetMs = anchor - LEAD_TARGETS[lead].days * DAY_MS;
  // Never existed this far out: a three-day market has no thirty-day price, and its
  // first tick is not one.
  if (targetMs < ordered[0].t) return null;

  let carried: number | null = null;
  for (const point of ordered) {
    if (point.t > targetMs) break;
    carried = point.p;
  }
  return carried;
}

export function observationsFor(
  venue: CalibrationVenue,
  topic: string,
  series: { t: number; p: number }[],
  yes: boolean,
): Observation[] {
  const out: Observation[] = [];
  for (const lead of LEAD_BUCKETS) {
    const price = priceAtLead(series, lead);
    if (price == null) continue;
    const bucket = priceBucketIndex(price * 100);
    if (bucket == null) continue;
    out.push({ venue, topic, lead, bucket, price, yes });
  }
  return out;
}
