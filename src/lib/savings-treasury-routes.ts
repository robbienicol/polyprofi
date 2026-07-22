import { TreasuryBillYield } from '@/api/client/market-data';
import { projectedProfitFromAnnualYield } from '@/lib/factual-route-data';
import { Route } from '@/types/routes';

function formatMaturity(days: number): string {
  if (days < 60) return `${Math.round(days / 7)}w`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

export function buildTreasuryRoutes({
  yields,
  balance,
  target,
  deadlineDays,
}: {
  yields: TreasuryBillYield[];
  balance: number;
  target: number;
  deadlineDays: number;
}): Route[] {
  return yields
    .filter((term) => term.days <= deadlineDays)
    .map((term) => {
      const projectedProfit = projectedProfitFromAnnualYield(balance, term.yieldPct, term.days);
      const hitsGoal = projectedProfit >= target;
      const maturity = formatMaturity(term.days);
      return {
        id: `treasury-${term.days}d`,
        category: 'Savings & Treasuries',
        emoji: '🏦',
        description: `Buy a ${term.label} — ${term.yieldPct.toFixed(2)}% sourced yield projects +$${projectedProfit} in ${maturity}.`,
        riskLevel: 1,
        probability: 99,
        expectedReturn: projectedProfit,
        platform: 'TreasuryDirect / brokerage',
        strategy: hitsGoal
          ? `This reaches the $${target} goal before the ${deadlineDays}d deadline. Hold to maturity; compare after-tax yield and settlement timing before buying.`
          : `This matures before the ${deadlineDays}d deadline but projects below the $${target} goal. Hold to maturity; compare after-tax yield and settlement timing before buying.`,
        maturesInDays: term.days,
        lossProfile: 'partial',
        meetsTarget: hitsGoal,
        investmentFacts: {
          yieldPct: term.yieldPct,
          yieldLabel: term.yieldLabel,
          yieldAsOf: term.yieldAsOf,
          yieldSource: term.yieldSource,
          yieldSourceUrl: term.yieldSourceUrl,
          projectedProfit,
          projectionBasis: `$${balance.toLocaleString()} × ${term.yieldPct.toFixed(2)}% annual yield × ${term.days}/365 days`,
          liquidity: 'Treasury bill held to maturity or sold in secondary market',
          sourceCheckedAt: new Date().toISOString(),
        },
      } satisfies Route;
    })
    .sort((a, b) => {
      const hit = Number(b.meetsTarget) - Number(a.meetsTarget);
      if (hit !== 0) return hit;
      if (a.meetsTarget && b.meetsTarget) return (a.maturesInDays ?? 0) - (b.maturesInDays ?? 0);
      return b.expectedReturn - a.expectedReturn;
    });
}
