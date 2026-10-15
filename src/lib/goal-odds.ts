import { probabilityOfTargetMove } from '@/lib/volatility-probability';
import type { Route } from '@/types/routes';

/**
 * The one number the list is ranked on: the chance this route gets you to your goal,
 * at a stake you can stomach losing.
 *
 * The old 0-100 score blended four things with weights we chose, so "82" meant
 * nothing a user could check. This answers the question they actually asked — "how
 * likely am I to make $X by then?" — and sizes every route to the most they said they
 * are OK losing, so an 88% contract that could lose $1,140 is not put in front of
 * someone who will only risk $400. It is shrunk to $400, and its odds told honestly
 * at that size.
 *
 * There is no edge claimed between two market-priced bets: a market's price is its
 * odds. What is ranked is fit to the goal, not which bet is "better".
 */

export interface GoalOddsInput {
  /** Profit the user is after. */
  target: number;
  /** Most they are willing to put in. */
  budget: number;
  /** Most they are OK losing in a bad case. Null means up to the whole budget. */
  maxLoss: number | null;
  /** Calendar days to the deadline. */
  deadlineDays: number;
  /** Stake that makes this route pay the target, from `stakeNeededForReturn`. */
  requiredStake: number | null;
}

export type BadCaseKind = 'none' | 'all' | 'stop' | 'tail';

export interface GoalOdds {
  /** What to put in: never more than the budget, never more than the loss cap allows. */
  stake: number;
  /** Chance, 0-100, of reaching the full target at this stake. 0 when it can't. */
  chance: number;
  /** Whether this stake can reach the full target at all. */
  hitsGoal: boolean;
  /** Profit if it works at this stake — the target, or less when the loss cap shrinks it. */
  profitIfItWorks: number;
  /** Dollars lost in the bad case at this stake. */
  badCase: number;
  /**
   * What "bad case" means for this route, so the card can say it honestly:
   * all = an all-or-nothing contract loses the stake; stop = a bracket's stop;
   * tail = a 1-in-20 bad stretch for something that can fall but not vanish.
   */
  badCaseKind: BadCaseKind;
  /** True when the loss cap, not the budget, set the stake. */
  cappedByLoss: boolean;
}

/** One-sided 95th percentile of a standard normal: a 1-in-20 bad stretch. */
const TAIL_Z = 1.645;
/** Rough drawdown per risk level for held assets with no volatility on record. */
const DRAWDOWN_PER_RISK_LEVEL = 0.08;

export function tradingDays(calendarDays: number): number {
  return Math.max(1, Math.round((calendarDays * 252) / 365));
}

function isVolatilityPriced(route: Route): boolean {
  return route.dailyVolatility != null && route.dailyVolatility > 0;
}

function isCashLike(route: Route): boolean {
  return route.category === 'Savings & Treasuries' && route.riskLevel <= 1;
}

/**
 * Fraction of the stake lost in the bad case. Derived from the route's own facts
 * rather than one heuristic for everything: a contract's loss is total, a bracket's
 * is its stop, a fund's is how far it fell in a 1-in-20 stretch of this length.
 */
export function badCaseFraction(route: Route, deadlineDays: number): { fraction: number; kind: BadCaseKind } {
  if (route.noCapitalRequired || isCashLike(route)) return { fraction: 0, kind: 'none' };
  if (route.optionPosition && route.optionPosition.lotCost > 0) {
    return { fraction: Math.min(1, route.optionPosition.maxLoss / route.optionPosition.lotCost), kind: 'all' };
  }
  if (route.exitPlan) return { fraction: route.exitPlan.effectiveLossFraction, kind: 'stop' };
  if (route.lossProfile === 'binary') return { fraction: 1, kind: 'all' };
  if (isVolatilityPriced(route)) {
    const days = tradingDays(deadlineDays);
    const sigmaT = route.dailyVolatility! * Math.sqrt(days);
    const driftT = Math.log(1 + (route.annualDriftPct ?? 0) / 100) * (days / 252);
    return { fraction: Math.max(0, Math.min(1, 1 - Math.exp(driftT - TAIL_Z * sigmaT))), kind: 'tail' };
  }
  return { fraction: Math.min(1, route.riskLevel * DRAWDOWN_PER_RISK_LEVEL), kind: 'tail' };
}

export function goalOdds(route: Route, input: GoalOddsInput): GoalOdds {
  const { target, budget, deadlineDays, requiredStake } = input;
  const maxLoss = input.maxLoss ?? budget;
  const { fraction, kind } = badCaseFraction(route, deadlineDays);
  const lossCap = fraction > 0 ? maxLoss / fraction : Infinity;
  const cap = Math.max(0, Math.min(budget, lossCap));
  const cappedByLoss = lossCap < budget;

  // Cuts and rewards: no money in, so nothing to size. They reach the goal or they don't.
  if (route.noCapitalRequired) {
    const hits = route.expectedReturn >= target;
    return {
      stake: 0,
      chance: hits ? route.probability : 0,
      hitsGoal: hits,
      profitIfItWorks: route.expectedReturn,
      badCase: 0,
      badCaseKind: 'none',
      cappedByLoss: false,
    };
  }

  // A fund or a coin: more money means a smaller move is needed, so the odds rise with
  // the stake. Use all the room the loss cap leaves, and recompute the odds at that size.
  if (isVolatilityPriced(route)) {
    const stake = Math.floor(cap);
    const chance = stake > 0
      ? probabilityOfTargetMove(route.dailyVolatility!, (target / stake) * 100, tradingDays(deadlineDays), route.annualDriftPct ?? 0) ?? 0
      : 0;
    return {
      stake,
      chance,
      hitsGoal: stake > 0 && chance > 0,
      profitIfItWorks: target,
      badCase: Math.round(stake * fraction),
      badCaseKind: kind,
      cappedByLoss,
    };
  }

  // Everything else pays in proportion to the stake: put in exactly what reaches the
  // target, or as much as the cap allows and say how far short that falls.
  if (requiredStake != null && requiredStake > 0 && requiredStake <= cap) {
    return {
      stake: requiredStake,
      chance: route.probability,
      hitsGoal: true,
      profitIfItWorks: target,
      badCase: Math.round(requiredStake * fraction),
      badCaseKind: kind,
      cappedByLoss: false,
    };
  }
  const stake = Math.floor(cap);
  const profit = requiredStake && requiredStake > 0 ? (target * stake) / requiredStake : 0;
  return {
    stake,
    chance: 0,
    hitsGoal: false,
    profitIfItWorks: Math.round(profit),
    badCase: Math.round(stake * fraction),
    badCaseKind: kind,
    cappedByLoss,
  };
}

/**
 * The ranking. Routes that can reach the goal come first, most likely first; equal
 * odds go to the smaller bad case, then the sooner payout. Routes that can only get
 * part of the way follow, by how far they get.
 */
export function compareGoalOdds(a: { route: Route; odds: GoalOdds }, b: { route: Route; odds: GoalOdds }): number {
  if (a.odds.hitsGoal !== b.odds.hitsGoal) return a.odds.hitsGoal ? -1 : 1;
  if (a.odds.hitsGoal) {
    const byChance = Math.round(b.odds.chance) - Math.round(a.odds.chance);
    if (byChance !== 0) return byChance;
    const byLoss = a.odds.badCase - b.odds.badCase;
    if (byLoss !== 0) return byLoss;
    return (a.route.maturesInDays ?? Infinity) - (b.route.maturesInDays ?? Infinity);
  }
  return b.odds.profitIfItWorks - a.odds.profitIfItWorks;
}

// ── self-check ──────────────────────────────────────────────────────────────
export function __selfCheck(): void {
  const base: Route = {
    id: 'x', category: 'Polymarket', emoji: '🔮', description: '', platform: 'Polymarket', strategy: '',
    meetsTarget: true, probability: 88, expectedReturn: 100, lossProfile: 'binary', riskLevel: 3,
  };
  const input = { target: 100, budget: 1000, maxLoss: 400, deadlineDays: 90 };

  // 80¢: $400 wins $100 — inside a $400 loss cap.
  const eighty = goalOdds({ ...base, probability: 80 }, { ...input, requiredStake: 400 });
  console.assert(eighty.hitsGoal && eighty.stake === 400 && eighty.badCase === 400, '80c contract fits a $400 cap exactly');

  // 90¢ needs $900 to win $100; capped at $400 it only gets part of the way.
  const ninety = goalOdds({ ...base, probability: 90 }, { ...input, requiredStake: 900 });
  console.assert(!ninety.hitsGoal && ninety.stake === 400 && ninety.profitIfItWorks === 44, '90c contract is shrunk to the cap and says how far it gets');
  console.assert(ninety.chance === 0, 'a route that cannot reach the goal has no chance of reaching it');

  // No loss cap: the budget is the only limit.
  console.assert(goalOdds({ ...base, probability: 90 }, { ...input, maxLoss: null, requiredStake: 900 }).hitsGoal, 'without a cap the budget decides');

  // A fund: the 1-in-20 bad case, not the whole stake, is what the cap is measured against.
  const fund: Route = { ...base, category: 'Stocks & ETFs', lossProfile: 'partial', dailyVolatility: 0.01, annualDriftPct: 8 };
  const sized = goalOdds(fund, { ...input, requiredStake: 1000 });
  console.assert(sized.badCaseKind === 'tail' && sized.badCase <= 400 && sized.stake === 1000, 'a calm fund can use the whole budget within the cap');
  const tighter = goalOdds(fund, { ...input, maxLoss: 50, requiredStake: 1000 });
  console.assert(tighter.stake < 1000 && tighter.chance < sized.chance, 'a tighter cap means a smaller stake and lower odds');

  // A T-bill loses nothing, so the cap never binds; cash-like routes size to the budget.
  const bill: Route = { ...base, category: 'Savings & Treasuries', lossProfile: 'partial', riskLevel: 1, probability: 99 };
  const billOdds = goalOdds(bill, { ...input, requiredStake: 10_000 });
  console.assert(billOdds.badCase === 0 && billOdds.stake === 1000 && billOdds.profitIfItWorks === 10, 'a T-bill uses the budget and reports what it earns');

  // Ranking: reaching the goal beats not; higher chance first; then smaller loss.
  const rows = [
    { route: { ...base, id: 'partial' }, odds: ninety },
    { route: { ...base, id: 'eighty' }, odds: eighty },
    { route: { ...base, id: 'fund' }, odds: sized },
  ].sort(compareGoalOdds);
  console.assert(rows[rows.length - 1].route.id === 'partial', 'a route that cannot reach the goal ranks last');
}
