/**
 * The Pathey score. The pieces live in @/lib/score/: the user-set weights, the goal
 * effectiveness score itself, and the words a score is shown with.
 */
export {
  DEFAULT_SCORE_WEIGHTS,
  SCORE_WEIGHT_KEYS,
  normalizeScoreWeights,
  type ScoreWeights,
} from '@/lib/score/weights';
export {
  goalEffectivenessScore,
  sortByPatheyScore,
  type GoalScoreBreakdown,
  type GoalScoreContext,
} from '@/lib/score/goal-score';
export { scoreBand, scoreVerdict, scoreVerdictShort } from '@/lib/score/verdicts';
export { __selfCheck } from '@/lib/score/check';
