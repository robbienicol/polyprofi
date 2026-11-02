/**
 * What actually happened to markets that were priced like this one. The lookup, the
 * arithmetic and the rules that keep it honest live in @/lib/calibration/reading.
 */
export {
  LEAD_BUCKETS,
  MIN_CELL_SAMPLE,
  PRICE_BUCKET_EDGES,
  cellKey,
  leadBucketFor,
  priceBucketIndex,
  priceBucketLabel,
  readCalibration,
  resolveCohort,
  wilsonInterval,
  type CalibrationCell,
  type CalibrationCohort,
  type CalibrationInput,
  type CalibrationReading,
  type CalibrationVenue,
  type LeadBucket,
} from '@/lib/calibration/reading';
export { __selfCheck } from '@/lib/calibration/check';
