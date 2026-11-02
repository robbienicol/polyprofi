/**
 * The five bands a score falls into, and the words for them. One definition, because
 * the list card and the score's own working have to agree: a card that says "Good fit"
 * over a screen that says "Workable, with trade-offs" is two different answers to the
 * same question.
 *
 * `band` is the index into `RiskScale` / `RiskTextScale`, safe → risky.
 */
export function scoreBand(score: number): 0 | 1 | 2 | 3 | 4 {
  if (score >= 80) return 0;
  if (score >= 65) return 1;
  if (score >= 50) return 2;
  if (score >= 35) return 3;
  return 4;
}

const SCORE_VERDICTS = [
  'Strong fit for this goal',
  'Good fit for this goal',
  'Workable, with trade-offs',
  'Weak fit for this goal',
  'Poor fit for this goal',
] as const;

const SCORE_VERDICTS_SHORT = ['Strong fit', 'Good fit', 'Workable', 'Weak fit', 'Poor fit'] as const;

export function scoreVerdict(score: number): string {
  return SCORE_VERDICTS[scoreBand(score)];
}

/** The same verdict where a card has room for two words, not five. */
export function scoreVerdictShort(score: number): string {
  return SCORE_VERDICTS_SHORT[scoreBand(score)];
}
