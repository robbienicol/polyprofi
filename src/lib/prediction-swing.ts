/**
 * Bracket ("trade the swing") math for prediction-market contracts. The math and the
 * reasoning behind it live in @/lib/prediction-swing/bracket — read its header first.
 */
export {
  PRESERVES_CAPITAL_BELOW,
  barrierHitProbability,
  bracketLossProfile,
  bracketRiskLevel,
  breakevenHitProbability,
  buildSwingPlan,
  expectedBarrierDays,
  observedDailySigmaCents,
  resolvesInTimeProbability,
  stopGapRisk,
  type SwingPlanInput,
} from '@/lib/prediction-swing/bracket';
export { __selfCheck } from '@/lib/prediction-swing/check';
