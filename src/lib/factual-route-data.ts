import { StockQuote } from '@/api/client/market-data';
import { plainYieldDescription, yieldInstrument } from '@/lib/plain-yield-copy';
import { isDebtRoute } from '@/lib/route-investment-metrics';
import { Route } from '@/types/routes';

function routeText(route: Route): string {
  return [route.category, route.description, route.platform, route.strategy, route.line]
    .filter(Boolean)
    .join(' ');
}

function daysForProjection(route: Route, fallbackDays: number): number {
  return Math.max(1, route.maturesInDays ?? fallbackDays);
}

export function projectedProfitFromAnnualYield(principal: number, annualYieldPct: number, days: number): number {
  if (principal <= 0 || annualYieldPct <= 0 || days <= 0) return 0;
  return Math.round(principal * (annualYieldPct / 100) * (days / 365));
}

function sourceForDebtRoute(route: Route, quotes: StockQuote[]): StockQuote | null {
  const text = routeText(route);
  if (/\bSGOV\b/i.test(text)) return quotes.find((q) => q.symbol === 'SGOV' && q.yieldPct != null) ?? null;
  if (/13[-\s]?week|13w/i.test(text) || (route.maturesInDays != null && route.maturesInDays >= 85 && route.maturesInDays <= 98)) {
    return quotes.find((q) => q.symbol === '^IRX' && q.yieldPct != null) ?? null;
  }
  return null;
}


export function applySourcedDebtFacts(
  routes: Route[],
  quotes: StockQuote[],
  principal: number,
  fallbackDays: number,
  target: number
): Route[] {
  return routes.map((route) => {
    if (!isDebtRoute(route)) return route;
    if (route.investmentFacts?.yieldPct != null) return route;

    const source = sourceForDebtRoute(route, quotes);
    if (!source?.yieldPct) {
      return {
        ...route,
        investmentFacts: {
          ...route.investmentFacts,
          projectionBasis: 'No sourced yield available; projected profit withheld.',
          sourceCheckedAt: new Date().toISOString(),
        },
      };
    }

    const days = daysForProjection(route, fallbackDays);
    const projectedProfit = projectedProfitFromAnnualYield(principal, source.yieldPct, days);
    const instrument = source.symbol === '^IRX' ? '13-week T-bill' : source.symbol;
    const yieldLabel = source.yieldLabel ?? 'sourced yield';
    return {
      ...route,
      description: plainYieldDescription({
        instrument: source.symbol === '^IRX' ? 'tbill' : source.symbol === 'SGOV' ? 'treasury-fund' : yieldInstrument(route),
        stake: principal,
        profit: projectedProfit,
        days,
        yieldPct: source.yieldPct,
        name: instrument,
      }),
      expectedReturn: projectedProfit,
      meetsTarget: projectedProfit >= target,
      strategy: `${route.strategy} Source: ${source.yieldSource} (${yieldLabel} ${source.yieldPct.toFixed(2)}%, as of ${source.yieldAsOf}). Projection: $${principal.toLocaleString()} × ${source.yieldPct.toFixed(2)}% × ${days}/365 days.`,
      investmentFacts: {
        ...route.investmentFacts,
        yieldPct: source.yieldPct,
        yieldLabel: source.yieldLabel,
        yieldAsOf: source.yieldAsOf,
        yieldSource: source.yieldSource,
        yieldSourceUrl: source.yieldSourceUrl,
        projectedProfit,
        projectionBasis: `$${principal.toLocaleString()} × ${source.yieldPct.toFixed(2)}% annual yield × ${days}/365 days`,
        liquidity: source.symbol === 'SGOV' ? 'ETF shares, market-hours liquidity' : 'Treasury bill held to maturity or sold in secondary market',
        expenseRatioPct: source.expenseRatioPct,
        sourceCheckedAt: new Date().toISOString(),
      },
    };
  });
}
