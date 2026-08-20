import { Route } from '@/types/routes';

const DEBT_PATTERN = /treasur|t-?bill|bond|hysa|high-yield savings|savings|cd\b|fixed income|debt/i;

function combinedText(route: Route): string {
  return [route.category, route.description, route.platform, route.strategy, route.line]
    .filter(Boolean)
    .join(' ');
}

export function isDebtRoute(route: Route): boolean {
  return DEBT_PATTERN.test(combinedText(route));
}

export function debtYieldLabel(route: Route, _principal?: number | null): string | null {
  if (!isDebtRoute(route)) return null;
  const sourced = route.investmentFacts?.yieldPct;
  if (sourced != null) {
    const label = route.investmentFacts?.yieldLabel ?? 'sourced yield';
    return `${sourced.toFixed(sourced >= 10 ? 1 : 2)}% ${label}`;
  }
  return null;
}

export function debtLiquidityLabel(route: Route): string | null {
  if (!isDebtRoute(route)) return null;
  if (route.investmentFacts?.liquidity) return route.investmentFacts.liquidity;
  const text = combinedText(route);
  if (/hysa|savings/i.test(text)) return 'Same-day to 2-day access';
  if (/t-?bill|treasury/i.test(text)) return 'Liquid Treasury market';
  if (/\bcd\b/i.test(text)) return 'Check early-withdrawal terms';
  if (/bond/i.test(text)) return 'Price can move before maturity';
  return 'Check exit terms';
}

export interface DeadlineFit {
  /** Short phrase for a fact tile: "2w before", "3d late". */
  label: string;
  /** True when the instrument pays out after the user needs the money. */
  misses: boolean;
}

/**
 * How a debt instrument's maturity sits against the goal deadline. A 4-week bill at
 * 5% is the wrong instrument for a one-week goal however good the rate is, and the
 * user should not have to subtract two numbers to notice.
 *
 * Returns null when either side is unknown — an invented comparison would be worse
 * than none.
 */
export function deadlineFitLabel(
  maturesInDays: number | null | undefined,
  deadlineDays: number | null | undefined,
): DeadlineFit | null {
  if (maturesInDays == null || deadlineDays == null || deadlineDays <= 0) return null;
  const slack = deadlineDays - maturesInDays;
  if (slack < 0) return { label: `${describeDays(-slack)} late`, misses: true };
  if (slack === 0) return { label: 'Lands on the day', misses: false };
  return { label: `${describeDays(slack)} to spare`, misses: false };
}

function describeDays(days: number): string {
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}

function invariant(condition: boolean, message: string): void {
  if (!condition) throw new Error(`[route-investment-metrics] ${message}`);
}

export function __selfCheck(): void {
  const debt = (over: Partial<Route> = {}): Route => ({
    id: 'sgov',
    category: 'Savings & Treasuries',
    emoji: '🏦',
    description: 'Put your $1,000 in SGOV (0-3 month T-bills)',
    riskLevel: 1,
    probability: 98,
    expectedReturn: 12,
    platform: 'iShares',
    strategy: 'Hold to maturity.',
    lossProfile: 'partial',
    meetsTarget: false,
    ...over,
  });

  invariant(isDebtRoute(debt()), 'a treasury route is debt');
  invariant(!isDebtRoute(debt({ category: 'Crypto', description: 'Buy BTC', strategy: '' })), 'crypto is not debt');

  // ── deadline fit ──────────────────────────────────────────────────────────
  invariant(deadlineFitLabel(30, 90)?.label === '2mo to spare', 'slack is described in the largest sensible unit');
  invariant(deadlineFitLabel(30, 90)?.misses === false, 'maturing early does not miss the deadline');
  invariant(deadlineFitLabel(30, 37)?.label === '1w to spare', 'a week of slack reads as a week');
  invariant(deadlineFitLabel(30, 33)?.label === '3d to spare', 'a few days of slack reads in days');
  invariant(deadlineFitLabel(30, 30)?.label === 'Lands on the day', 'landing exactly on the deadline is called out');
  invariant(deadlineFitLabel(30, 30)?.misses === false, 'landing on the day is not late');
  invariant(deadlineFitLabel(30, 7)?.misses === true, 'maturing after the deadline misses it');
  invariant(deadlineFitLabel(30, 7)?.label === '3w late', 'lateness is described, not just flagged');
  invariant(deadlineFitLabel(8, 7)?.label === '1d late', 'a single day late is still late');
  invariant(deadlineFitLabel(null, 30) === null, 'an unknown maturity yields no comparison');
  invariant(deadlineFitLabel(30, null) === null, 'an unknown deadline yields no comparison');
  invariant(deadlineFitLabel(30, 0) === null, 'a zero deadline is treated as unknown, not as instant');
}
