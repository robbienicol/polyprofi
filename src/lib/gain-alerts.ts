import type { PositionValuation } from '@/lib/portfolio-progress';

/**
 * Which single piece of good news is worth a push today, if any.
 *
 * Three rules shape everything here, and they are all about restraint rather
 * than coverage:
 *
 * 1. **One a day, at most.** A position that keeps climbing is not three
 *    notifications, and a portfolio of ten is not ten. The best candidate wins
 *    and the rest are dropped, not queued — stale good news is worse than none.
 * 2. **Only ever upward, and only once per tier.** A position crossing +10% is
 *    news; the same position wobbling around +10% for a week is not. The tier
 *    already announced is remembered, so a bet has to reach a genuinely higher
 *    band before it can speak again.
 * 3. **Never the same thing twice.** Hitting the goal outright already fires
 *    its own notification and its own celebration screen, so the milestones
 *    here stop at 75%.
 */

/** Position gain bands, ascending. Crossing into a new one is the news. */
export const GAIN_TIERS: readonly number[] = [10, 25, 50, 100];

/**
 * Goal-progress milestones, in percent of target. 100 is deliberately absent:
 * `notifyGoalAchieved` and the celebration screen own that moment.
 */
export const GOAL_MILESTONES: readonly number[] = [25, 50, 75];

/**
 * Floor on what counts as a move worth interrupting someone for. A 10% gain on
 * a $4 stake is 40 cents, and a push for 40 cents trains people to ignore the
 * next one.
 */
export const MIN_GAIN_DOLLARS = 5;

export interface AlertLedger {
  /** Local calendar day (YYYY-MM-DD) an alert was last sent. Null: never. */
  lastSentDay: string | null;
  /** Highest gain tier already announced, per bet id. */
  betTier: Record<string, number>;
  /** Highest milestone already announced, per goal id. */
  goalMilestone: Record<string, number>;
}

export const EMPTY_LEDGER: AlertLedger = { lastSentDay: null, betTier: {}, goalMilestone: {} };

export interface GainCandidate {
  kind: 'position';
  betId: string;
  /** The tier crossed, for the ledger and the copy. */
  tier: number;
  gain: number;
  returnPct: number;
}

export interface MilestoneCandidate {
  kind: 'milestone';
  goalId: string;
  milestone: number;
  netGain: number;
  targetAmount: number;
}

export type AlertCandidate = GainCandidate | MilestoneCandidate;

/** The highest band a value has reached, or null when it is below all of them. */
export function tierFor(value: number, tiers: readonly number[]): number | null {
  let reached: number | null = null;
  for (const tier of tiers) if (value >= tier) reached = tier;
  return reached;
}

export function localDay(now: Date): string {
  // Local, not UTC: "once a day" means the user's day. toISOString would roll
  // over at 7pm for someone in New York and make two alerts one evening legal.
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Positions that have climbed into a tier they have not announced yet. */
export function gainCandidates(
  positions: PositionValuation[],
  ledger: AlertLedger,
): GainCandidate[] {
  return positions.flatMap((position) => {
    if (position.unrealizedPnl < MIN_GAIN_DOLLARS) return [];
    const tier = tierFor(position.returnPct, GAIN_TIERS);
    if (tier == null || tier <= (ledger.betTier[position.betId] ?? 0)) return [];
    return [{
      kind: 'position' as const,
      betId: position.betId,
      tier,
      gain: position.unrealizedPnl,
      returnPct: position.returnPct,
    }];
  });
}

export interface GoalSnapshot {
  goalId: string;
  netGain: number;
  targetAmount: number;
}

/** Goals that have crossed a milestone they have not announced yet. */
export function milestoneCandidates(
  goals: GoalSnapshot[],
  ledger: AlertLedger,
): MilestoneCandidate[] {
  return goals.flatMap((goal) => {
    if (goal.targetAmount <= 0 || goal.netGain <= 0) return [];
    const percent = (goal.netGain / goal.targetAmount) * 100;
    const milestone = tierFor(percent, GOAL_MILESTONES);
    if (milestone == null || milestone <= (ledger.goalMilestone[goal.goalId] ?? 0)) return [];
    return [{
      kind: 'milestone' as const,
      goalId: goal.goalId,
      milestone,
      netGain: goal.netGain,
      targetAmount: goal.targetAmount,
    }];
  });
}

/**
 * The one alert to send now, or null.
 *
 * A milestone beats a position gain of any size: "you are halfway to the car"
 * is about the thing they actually want, where "SGOV is up 12%" is about an
 * instrument. Within a kind, the bigger number wins.
 */
export function selectAlert({ positions, goals, ledger, now }: {
  positions: PositionValuation[];
  goals: GoalSnapshot[];
  ledger: AlertLedger;
  now: Date;
}): AlertCandidate | null {
  if (ledger.lastSentDay === localDay(now)) return null;

  const milestones = milestoneCandidates(goals, ledger)
    .sort((a, b) => b.milestone - a.milestone);
  if (milestones.length > 0) return milestones[0];

  const gains = gainCandidates(positions, ledger).sort((a, b) => b.tier - a.tier || b.gain - a.gain);
  return gains[0] ?? null;
}

/** The ledger after an alert is sent, so the same news cannot repeat. */
export function recordAlert(ledger: AlertLedger, candidate: AlertCandidate, now: Date): AlertLedger {
  const base = { ...ledger, lastSentDay: localDay(now) };
  if (candidate.kind === 'position') {
    return { ...base, betTier: { ...ledger.betTier, [candidate.betId]: candidate.tier } };
  }
  return { ...base, goalMilestone: { ...ledger.goalMilestone, [candidate.goalId]: candidate.milestone } };
}

// ── self-check ──────────────────────────────────────────────────────────────
function position(over: Partial<PositionValuation> & { betId: string }): PositionValuation {
  return { costBasis: 100, value: 100, unrealizedPnl: 0, returnPct: 0, pricing: 'live', ...over };
}

export function __selfCheck(): void {
  const now = new Date('2026-08-26T15:00:00');
  const up12 = position({ betId: 'a', unrealizedPnl: 12, returnPct: 12 });
  const up60 = position({ betId: 'b', unrealizedPnl: 60, returnPct: 60 });

  console.assert(tierFor(12, GAIN_TIERS) === 10, '12% sits in the 10 band');
  console.assert(tierFor(9, GAIN_TIERS) === null, 'under the first band is not news');
  console.assert(tierFor(400, GAIN_TIERS) === 100, 'above the top band stays in the top band');

  const first = selectAlert({ positions: [up12], goals: [], ledger: EMPTY_LEDGER, now });
  console.assert(first?.kind === 'position' && first.tier === 10, 'a position crossing +10% is news');

  // Rule 1: one a day.
  const after = recordAlert(EMPTY_LEDGER, first!, now);
  console.assert(
    selectAlert({ positions: [up60], goals: [], ledger: after, now }) === null,
    'a second alert the same day is dropped, however good it is',
  );
  const tomorrow = new Date('2026-08-27T09:00:00');
  console.assert(
    selectAlert({ positions: [up60], goals: [], ledger: after, now: tomorrow })?.kind === 'position',
    'the next day it can speak again',
  );

  // Rule 2: only upward, once per tier.
  const sameTier = recordAlert(EMPTY_LEDGER, { kind: 'position', betId: 'a', tier: 10, gain: 12, returnPct: 12 }, now);
  console.assert(
    selectAlert({ positions: [up12], goals: [], ledger: sameTier, now: tomorrow }) === null,
    'a position wobbling inside a tier it already announced stays quiet',
  );
  console.assert(
    selectAlert({
      positions: [position({ betId: 'a', unrealizedPnl: 30, returnPct: 30 })],
      goals: [], ledger: sameTier, now: tomorrow,
    })?.kind === 'position',
    'the same position climbing into a higher tier is news again',
  );

  // The dollar floor.
  console.assert(
    selectAlert({
      positions: [position({ betId: 'tiny', costBasis: 4, unrealizedPnl: 0.4, returnPct: 10 })],
      goals: [], ledger: EMPTY_LEDGER, now,
    }) === null,
    '40 cents is not worth a push, whatever the percentage says',
  );

  // Losses never speak.
  console.assert(
    selectAlert({
      positions: [position({ betId: 'down', unrealizedPnl: -50, returnPct: -50 })],
      goals: [], ledger: EMPTY_LEDGER, now,
    }) === null,
    'a position going the wrong way is never a notification',
  );

  // Milestones outrank gains.
  const halfway: GoalSnapshot = { goalId: 'g1', netGain: 300, targetAmount: 600 };
  const both = selectAlert({ positions: [up60], goals: [halfway], ledger: EMPTY_LEDGER, now });
  console.assert(
    both?.kind === 'milestone' && both.milestone === 50,
    'a goal milestone beats a position gain — it is about the thing they actually want',
  );

  // Rule 3: 100% belongs to the celebration screen.
  console.assert(
    selectAlert({
      positions: [], goals: [{ goalId: 'g1', netGain: 600, targetAmount: 600 }],
      ledger: { ...EMPTY_LEDGER, goalMilestone: { g1: 75 } }, now,
    }) === null,
    'reaching the goal outright is left to notifyGoalAchieved, not doubled up here',
  );
  console.assert(
    milestoneCandidates([{ goalId: 'g', netGain: 10, targetAmount: 0 }], EMPTY_LEDGER).length === 0,
    'an open-ended goal has no percentage to cross',
  );

  console.assert(localDay(new Date('2026-01-05T23:30:00')) === '2026-01-05', 'the day is the local one');
}
