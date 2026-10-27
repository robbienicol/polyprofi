/** Icon for a seeded goal that did not carry one of its own. */
export const CUSTOM_GOAL_EMOJI = '🎯';

/** A goal chosen in goal setup, carried here in the URL and not yet saved anywhere. */
export interface GoalSeed {
  label: string;
  emoji: string;
  /** Null for the open-ended goal, which has no finish line. */
  target: number | null;
}

/**
 * The seeded goal, or null when the quiz was opened any other way. Goal setup hands
 * the choice over rather than writing it, so a goal only ever reaches the Goals tab
 * by way of a search.
 */
export function goalSeedFrom(label?: string, emoji?: string, target?: string): GoalSeed | null {
  const trimmed = label?.trim();
  if (!trimmed) return null;
  const amount = Number(target);
  return {
    label: trimmed,
    emoji: emoji?.trim() || CUSTOM_GOAL_EMOJI,
    target: Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null,
  };
}
