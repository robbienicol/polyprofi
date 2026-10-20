/**
 * How much each component counts. Fixed constants for years; now a user input,
 * because "the best route" means different things to someone who cannot afford to
 * lose the stake and someone who needs the money by Friday. See `normalizeScoreWeights`
 * — the sliders hand over raw importance, not fractions.
 */
export interface ScoreWeights {
  reliability: number;
  principalProtection: number;
  capitalEfficiency: number;
  timeEfficiency: number;
}

export const SCORE_WEIGHT_KEYS = [
  'reliability',
  'principalProtection',
  'capitalEfficiency',
  'timeEfficiency',
] as const satisfies readonly (keyof ScoreWeights)[];

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  reliability: 0.35,
  principalProtection: 0.25,
  capitalEfficiency: 0.30,
  timeEfficiency: 0.10,
};

/**
 * Turn raw slider importance into weights that sum to 1, so the score stays on its
 * 0-100 scale no matter where the user leaves the sliders. Only the *ratios* between
 * the sliders matter — dragging all four to the top is the same as leaving all four
 * in the middle, which is what makes "more of everything" impossible to ask for.
 *
 * A set that is all zeros (or has no finite values at all) carries no preference, so
 * it falls back to the defaults rather than producing a score of zero for everything.
 */
export function normalizeScoreWeights(weights: ScoreWeights): ScoreWeights {
  const safe = SCORE_WEIGHT_KEYS.map((key) => {
    const value = weights[key];
    return Number.isFinite(value) && value > 0 ? value : 0;
  });
  const total = safe.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return DEFAULT_SCORE_WEIGHTS;
  return {
    reliability: safe[0] / total,
    principalProtection: safe[1] / total,
    capitalEfficiency: safe[2] / total,
    timeEfficiency: safe[3] / total,
  };
}
