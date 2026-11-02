/**
 * Quiz answers → search parameters, and the client-side filter that makes them shape
 * the feed. The pieces live in @/lib/quiz-profile/.
 */
export {
  TIMEFRAME_MATURITY_LIMITS,
  buildRouteParams,
  describeSearch,
  enforceRouteIntegrity,
  investmentSliderMaximum,
  isLongHorizon,
  referenceStakeFor,
  surveyAmountCeiling,
  timeframeMaturityLimit,
} from '@/lib/quiz-profile/params';
export { filterRoutesForQuiz } from '@/lib/quiz-profile/filter';
export { __selfCheck } from '@/lib/quiz-profile/check';
