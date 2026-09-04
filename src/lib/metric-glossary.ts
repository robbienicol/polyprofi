/**
 * Plain-language explanations for the numbers the app puts on screen.
 *
 * Several of these are ordinary finance metrics that read as alarming or
 * meaningless to someone who has never met them — "expected value" being the
 * worst offender, since a perfectly healthy position can show a small negative
 * one and it looks like a loss. The fix is not to hide the number: it is to let
 * anyone tap it and be told, in a sentence, what it is and why it is here.
 *
 * Entries are kept here rather than beside each component so the same metric is
 * explained the same way wherever it appears — the Portfolio tab and a goal page
 * show the same tiles, and two explanations for one number is worse than none.
 *
 * House style for the copy:
 *  - `what` is one sentence, no jargon, no formula.
 *  - `why` says why the user should care, in their terms.
 *  - `reading` is optional and gives the one misreading worth heading off.
 * Nothing here promises a return or advises an action.
 */
export interface MetricExplainer {
  /** Title of the sheet. Matches the on-screen label of the metric. */
  title: string;
  /** One sentence: what the number is. */
  what: string;
  /** One or two sentences: why it is worth looking at. */
  why: string;
  /** Optional: the misreading this metric invites, named and corrected. */
  reading?: string;
  /** Optional: how it is worked out, for anyone who wants it. Still plain words. */
  workedOut?: string;
}

export const METRIC_EXPLAINERS = {
  expectedProfit: {
    title: 'Expected profit',
    what: 'The average profit across every way your positions could turn out, with the likelier outcomes counting for more.',
    why: 'It is the single number that weighs a big win you probably will not get against a small one you probably will. Comparing two plans by it tells you which is worth more on average.',
    reading:
      'A small negative number is not a loss and does not mean something has gone wrong — no money has moved. It means the odds and the payouts roughly cancel, which is ordinary. It is a forecast, not your balance.',
    workedOut:
      'Each position: the chance it lands times what it pays, less the chance it does not times what it would cost you. Then all of them added up.',
  },
  expectedPayout: {
    title: 'Expected payout',
    what: 'What you would be holding on an average run of luck — the money you put in, plus the expected profit on it.',
    why: 'Expected profit answers "how much more"; this answers "how much in total", which is the figure to hold against what your goal actually costs.',
    reading: 'An average, not a promise. Any single real outcome lands somewhere in the best-to-worst range, usually not exactly here.',
  },
  outcomeRange: {
    title: 'Best and worst case',
    what: 'The two ends of what could happen: everything landing, and everything going against you.',
    why: 'The average hides the spread. Two plans with the same expected payout can have very different worst days, and the worst end is the one worth being able to live with.',
    reading:
      'Neither end is a prediction, and reality almost always falls between them. The worst case is not a floor either — it is the modelled loss, not a guarantee.',
    workedOut:
      'Best case: every position pays what it was taken for. Worst case: prediction and options positions lose the whole stake, savings and Treasury positions keep it, and stocks and crypto are marked down by how risky the route was rated.',
  },
  capitalAtRisk: {
    title: 'At risk vs protected',
    what: 'How your money splits between positions whose principal can disappear and positions where it is not exposed to a market.',
    why: 'It is the plainest measure of how much of a bad run you can absorb. Two portfolios with the same expected profit are not the same portfolio if one has everything on the line.',
    reading:
      '"Protected" means the principal is not exposed to market moves — savings and Treasury holdings. It does not mean insured, and it does not mean the return is guaranteed.',
  },
  goalProbability: {
    title: 'Goal probability',
    what: 'The chance your positions land, averaged across them and weighted by how much money is in each.',
    why: 'A high number on a small stake does not carry a goal. Weighting by money is what makes this reflect the portfolio you actually hold.',
    reading: 'It is the average chance your positions come good, not the chance the goal itself is reached by a date.',
  },
  goalContribution: {
    title: 'What is moving the goal',
    what: 'Which positions have actually produced the gains counted toward your goal, and how much each has contributed.',
    why: 'Progress usually comes from fewer positions than people expect. Seeing which ones tells you what to do more of — and what is just sitting there.',
    reading: 'Gains only. The money you put in does not count toward a goal; a goal is reached on profit.',
  },
  timeToMaturity: {
    title: 'Average time to maturity',
    what: 'How long your positions still have to run, averaged and weighted by how much is in each.',
    why: 'A goal with a date needs positions that finish before it. This is the quickest way to see whether they do.',
    reading: 'Weighted by money, so a large slow position pulls it further than a small fast one.',
  },
  cheapestPath: {
    title: 'Cheapest path to your goal',
    what: 'How much you have to put in, on each of your routes, to earn one dollar of expected profit.',
    why: 'It ranks your options by what they cost rather than by what they might pay, which is what actually decides how far the money you have can get you.',
    reading:
      'Cheapest is not safest. A route can be efficient and still be the one most likely to lose the stake, so read it next to the risk on the position itself.',
  },
  conservativeMode: {
    title: 'Conservative projections',
    what: 'A stricter setting that assumes your stocks and crypto return nothing at all.',
    why: 'It shows what the plan looks like if only the contractual returns — the ones with a stated rate — come through.',
  },
  projectedAccrual: {
    title: 'Projected accrual',
    what: 'Interest a savings or Treasury position has earned so far, worked out from its rate and how long you have held it.',
    why: 'These positions have no live price to quote, so this is the only way to show them growing instead of sitting still.',
    reading: 'Estimated from the tracked rate and time held, not read from your account. It is not money you can spend yet.',
  },
  totalPnl: {
    title: 'Total P&L',
    what: 'Profit and loss: everything you have made, less everything you have lost, across settled and open positions together.',
    why: 'It is the one figure that answers "am I up?" for the whole set at once, rather than position by position.',
    reading:
      'Open positions are counted at what they are worth today, so this moves with the market and is not money banked until a position is settled.',
  },
  trackedValue: {
    title: 'Tracked value',
    what: 'What your positions are worth right now — what you put in, plus or minus how they have moved since.',
    why: 'This is the measured number on the screen. Everything else here is a forecast; this one is not.',
    reading: 'It covers what you have told the app about. It is not a balance read from your brokerage account.',
  },
} as const satisfies Record<string, MetricExplainer>;

export type MetricKey = keyof typeof METRIC_EXPLAINERS;

/** The entry for a metric, widened to the interface so optional fields are readable. */
export function explainerFor(metric: MetricKey): MetricExplainer {
  return METRIC_EXPLAINERS[metric];
}

// ── self-check ──────────────────────────────────────────────────────────────
export function __selfCheck(): void {
  const entries = Object.entries(METRIC_EXPLAINERS) as [MetricKey, MetricExplainer][];
  console.assert(entries.length > 0, 'the glossary has entries');
  for (const [key, entry] of entries) {
    console.assert(entry.title.trim().length > 0, `${key} has a title`);
    // One sentence, and short enough to read on a phone without scrolling past it.
    console.assert(entry.what.trim().length > 0 && entry.what.length < 220, `${key} says what it is, briefly`);
    console.assert(entry.why.trim().length > 0, `${key} says why it matters`);
    // The whole point is that these read as English. A metric explained with a
    // formula has not been explained.
    const jargon = /[=×÷]|\bΣ\b|\bp\(|\bE\[/;
    for (const field of [entry.what, entry.why, entry.reading, entry.workedOut]) {
      console.assert(!field || !jargon.test(field), `${key} explains itself without notation`);
    }
  }
}
