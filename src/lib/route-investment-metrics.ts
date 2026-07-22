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
