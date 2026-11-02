/**
 * Turns a recurring outflow detected in connected bank transactions into a Route —
 * the same shape every investment goes through `goalEffectivenessScore` as. No
 * separate "savings score" exists: `noCapitalRequired` already makes a cut read as
 * maximally capital-efficient (see @/lib/score), so the honest comparison against an
 * investment route falls out of running the identical formula, not a parallel one.
 *
 * This module only knows how to turn an already-clustered cut into a Route. Finding
 * the clusters themselves — grouping raw Plaid transactions by merchant, telling a
 * cancellable subscription from a discretionary habit — is a separate, not-yet-built
 * step that would sit in front of this one.
 */
import { goalEffectivenessScore } from '@/lib/score';
import { Route } from '@/types/routes';

export type SpendingCutKind = 'subscription' | 'discretionary';

export interface SpendingCut {
  id: string;
  /** What shows on the statement — "Netflix", "Blue Bottle Coffee". */
  merchant: string;
  kind: SpendingCutKind;
  /** What one month of this costs today, in dollars. */
  monthlyAmount: number;
  /**
   * How many of the last months actually carried this charge/pattern — confidence
   * that it is real and recurring, not a one-off. Higher only ever raises reliability.
   */
  monthsObserved: number;
  /**
   * Coefficient of variation on the monthly amount, 0–100. Meaningless for a
   * subscription (same charge every cycle); for a discretionary category it is the
   * only signal for whether "cut this" describes a real, holdable change or a number
   * that swings too much to promise.
   */
  amountVariancePct?: number;
}

/**
 * Confidence the cut actually happens and sticks — this is what the score's
 * `reliability` component reads, so it must answer "will this recur", not "did we
 * detect it right."
 *
 * A subscription is a one-tap cancellation with a fixed, contractual charge: high and
 * essentially flat. Discretionary spend requires an ongoing behavior change, and the
 * category's own variance is the only evidence for how likely that is to hold — a
 * coffee habit that already swings 60% month to month is not a reliable $X/mo cut,
 * whatever the average says.
 */
export function cutReliability(cut: SpendingCut): number {
  if (cut.kind === 'subscription') {
    // Not 100: cancellation flows fail, or a "free trial" auto-renews under a new plan.
    return 97;
  }
  const variance = clamp(cut.amountVariancePct ?? 50, 0, 100);
  const observationCredit = clamp(cut.monthsObserved, 0, 6) * 2; // up to +12 for a well-established pattern
  return clamp(80 - variance * 0.5 + observationCredit, 40, 85);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * How much of a discretionary category a cut actually asks you to give up.
 *
 * Not all of it. Pricing a category cut at its full monthly average quietly assumes
 * the user stops eating out — or buying food — entirely until the deadline, and the
 * number that falls out is both unreachable and plainly silly: a $380/mo grocery
 * average came out as "$4,623 toward your goal", true only if you stop eating. A
 * quarter is a change someone can describe to themselves and hold.
 *
 * A subscription has no equivalent: cancelling is all or nothing, so it keeps 1.
 */
const DISCRETIONARY_CUT_SHARE = 0.25;

/** What one month of actually taking this cut is worth, as opposed to what it costs. */
export function monthlySaving(cut: SpendingCut): number {
  return cut.kind === 'subscription' ? cut.monthlyAmount : cut.monthlyAmount * DISCRETIONARY_CUT_SHARE;
}

function describe(
  cut: SpendingCut,
  months: number,
  totalSaved: number,
  saving: number,
): { description: string; strategy: string } {
  const over = months === 1 ? 'in a month' : `over the next ${months} months`;
  if (cut.kind === 'subscription') {
    return {
      description: `Cancel ${cut.merchant}, $${cut.monthlyAmount.toFixed(2)} a month. Saves $${totalSaved} ${over}.`,
      strategy: `Charged on the same date ${cut.monthsObserved} months running, so this is a live subscription rather than a one-off. Cancelling is a single action with nothing to keep up afterwards — check for an early-cancellation fee first.`,
    };
  }
  const share = Math.round(DISCRETIONARY_CUT_SHARE * 100);
  return {
    description: `Spend ${share}% less on ${cut.merchant} — about $${saving.toFixed(0)} of the $${cut.monthlyAmount.toFixed(0)} a month you average. Saves $${totalSaved} ${over}.`,
    strategy: `Your own spending across ${cut.monthsObserved} months, not a single charge. The figure is ${share}% of it rather than all of it, because cutting a category to zero is not a plan anyone holds. It is a habit to keep up rather than one action, which is why it scores below a cancellation.`,
  };
}

/**
 * Builds one Route per detected cut. `deadlineDays` is the same goal deadline every
 * other route in the pool is scored against — the cut's payoff is what continuing it
 * from today until that date is worth, not some arbitrary window of its own.
 *
 * `maturesInDays` is left unset on purpose, the same convention `buildSavingsAccountRoute`
 * uses for a HYSA: there is no fixed term, the saving is available the moment you stop
 * spending, and `goalEffectivenessScore` already treats an unset maturity as "resolves
 * exactly at the deadline" rather than "resolves immediately" — right for something whose
 * full value only accrues by holding the cut all the way to that date.
 */
export function buildSpendingCutRoutes({
  cuts,
  target,
  deadlineDays,
}: {
  cuts: SpendingCut[];
  target: number;
  deadlineDays: number;
}): Route[] {
  const months = Math.max(1, deadlineDays / 30);
  return cuts
    .filter((cut) => cut.monthlyAmount > 0)
    .map((cut) => {
      const saving = monthlySaving(cut);
      const totalSaved = Math.round(saving * months);
      const { description, strategy } = describe(cut, Math.round(months), totalSaved, saving);
      return {
        id: `cut-${cut.id}`,
        category: 'Cut spending',
        emoji: '✂️',
        description,
        riskLevel: 1,
        probability: cutReliability(cut),
        expectedReturn: totalSaved,
        platform: 'Your bank account',
        strategy,
        lossProfile: 'partial',
        meetsTarget: totalSaved >= target,
        noCapitalRequired: true,
        spendingCut: { merchant: cut.merchant, kind: cut.kind, monthlyAmount: cut.monthlyAmount },
      } satisfies Route;
    })
    .sort((a, b) => b.expectedReturn - a.expectedReturn);
}

// ── self-check ──────────────────────────────────────────────────────────────
export function __selfCheck(): void {
  const netflix: SpendingCut = { id: 'netflix', merchant: 'Netflix', kind: 'subscription', monthlyAmount: 15.49, monthsObserved: 6 };
  const coffeeSteady: SpendingCut = {
    id: 'coffee-steady', merchant: 'Blue Bottle Coffee', kind: 'discretionary',
    monthlyAmount: 40, monthsObserved: 6, amountVariancePct: 10,
  };
  const coffeeErratic: SpendingCut = {
    id: 'coffee-erratic', merchant: 'Assorted cafes', kind: 'discretionary',
    monthlyAmount: 40, monthsObserved: 2, amountVariancePct: 80,
  };

  console.assert(cutReliability(netflix) === 97, 'a subscription cancellation is near-certain');
  console.assert(
    cutReliability(coffeeSteady) > cutReliability(coffeeErratic),
    'a consistent discretionary pattern is more reliable to cut than an erratic one',
  );
  console.assert(cutReliability(coffeeSteady) < cutReliability(netflix), 'no discretionary cut beats a subscription on reliability');

  const routes = buildSpendingCutRoutes({ cuts: [netflix, coffeeSteady], target: 100, deadlineDays: 90 });
  console.assert(routes.length === 2, 'one route per cut');
  console.assert(routes.every((r) => r.noCapitalRequired && r.riskLevel === 1 && r.lossProfile === 'partial'), 'every cut route is flagged zero-capital and capital-preserving');
  console.assert(routes.find((r) => r.id === 'cut-netflix')?.expectedReturn === 46, 'a cancellation is worth all of it: $15.49/mo × 3mo rounds to $46');
  console.assert(
    routes.find((r) => r.id === 'cut-coffee-steady')?.expectedReturn === 30,
    'a category cut is worth a quarter of it: $40/mo × 25% × 3mo is $30, not $120',
  );
  console.assert(routes[0].id === 'cut-netflix', 'the bigger REAL saving sorts first, which a $40/mo habit no longer is');
  console.assert(
    routes.find((r) => r.id === 'cut-coffee-steady')?.description.includes('$40 a month you average'),
    'the copy shows both numbers — what to save, out of what is being spent',
  );
  console.assert(monthlySaving(netflix) === netflix.monthlyAmount, 'cancelling saves the whole charge');
  console.assert(monthlySaving(coffeeSteady) === 10, 'cutting back saves a quarter of the habit');
  console.assert(routes.every((r) => r.maturesInDays === undefined), 'no fixed maturity — same convention as a liquid savings account');

  console.assert(
    buildSpendingCutRoutes({ cuts: [{ ...netflix, monthlyAmount: 0 }], target: 100, deadlineDays: 90 }).length === 0,
    'a zero-amount cut produces no route',
  );

  // The comparison this module exists for: does a cut actually score honestly against
  // an investment through the shared formula, with no bespoke savings metric?
  const [cutRoute] = buildSpendingCutRoutes({ cuts: [netflix], target: 40, deadlineDays: 90 });
  const breakdown = goalEffectivenessScore(cutRoute, {
    target: 40,
    requiredInvestment: 0,
    availableInvestment: 1000,
    deadlineDays: 90,
  });
  console.assert(breakdown.capitalEfficiency === 100, 'needing $0 reads as maximally capital-efficient');
  console.assert(breakdown.principalProtection === 100, 'nothing is ever put at risk, so principal protection maxes out');
  console.assert(breakdown.reliability === 97, 'reliability is the cut\'s own confidence, not automatically maxed');
  console.assert(
    breakdown.timeEfficiency === 50,
    'with no fixed maturity, the payoff is only complete right at the deadline — the floor, not the ceiling',
  );
  console.assert(breakdown.cap == null, 'a $0-cost, on-time route never hits the affordability or deadline caps');
}
