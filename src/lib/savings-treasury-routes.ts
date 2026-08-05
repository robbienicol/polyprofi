import { TreasuryBillYield } from '@/api/client/market-data';
import { projectedProfitFromAnnualYield } from '@/lib/factual-route-data';
import { Route } from '@/types/routes';

/** The 13-week T-bill is the app's standing proxy for "the going short-term rate" (see
 * playbook.ts's T-bill/HYSA baseline) — competitive online savings APYs track it closely
 * since both float with the Fed funds rate, just without a lock-in period. */
const HYSA_PROXY_TERM_LABEL = '13-week T-bill';

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

/**
 * A high-yield savings account has no fixed maturity — it's not held-to-term like a T-bill,
 * so this models it against the full deadline rather than any one term's days, and leaves
 * maturesInDays unset (liquid, capital-preserved routes with unknown maturity clear the
 * quiz timeframe filter automatically — see routeFitsTimeframe in quiz-profile.ts).
 * The APY itself is NOT a live bank quote — there's no bank-rate feed in this app — so it's
 * proxied off the 13-week T-bill yield and disclosed as such rather than fabricated.
 */
export function buildSavingsAccountRoute({
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
  const proxy = yields.find((term) => term.label === HYSA_PROXY_TERM_LABEL);
  if (balance <= 0 || !proxy) return [];

  const projectedProfit = projectedProfitFromAnnualYield(balance, proxy.yieldPct, deadlineDays);
  const hitsGoal = projectedProfit >= target;
  return [{
    id: 'savings-account-hysa',
    category: 'Savings & Treasuries',
    emoji: '🏦',
    description: `Park your $${balance.toLocaleString()} in a high-yield online savings account — top HYSAs track the ${proxy.label} closely (~${proxy.yieldPct.toFixed(2)}%), projecting +$${projectedProfit} over ${deadlineDays}d, withdrawable anytime.`,
    riskLevel: 1,
    probability: 99,
    expectedReturn: projectedProfit,
    platform: 'Online bank (e.g. Marcus, Ally, Discover)',
    strategy: `${hitsGoal ? 'This reaches' : 'This projects below'} the $${target} goal at current rates. Fully liquid — withdraw anytime, no lock-in or early-withdrawal penalty like a T-bill has. The APY here is a proxy off the ${proxy.label} yield (competitive online HYSAs track it closely, both float with the Fed funds rate) — not a live bank quote, so compare actual advertised APYs before committing; they vary by a few tenths of a point.`,
    lossProfile: 'partial',
    meetsTarget: hitsGoal,
    investmentFacts: {
      yieldPct: proxy.yieldPct,
      yieldLabel: `Proxy: ${proxy.label} yield (not a live bank quote)`,
      yieldAsOf: proxy.yieldAsOf,
      yieldSource: proxy.yieldSource,
      yieldSourceUrl: proxy.yieldSourceUrl,
      projectedProfit,
      projectionBasis: `$${balance.toLocaleString()} × ${proxy.yieldPct.toFixed(2)}% proxy annual yield × ${deadlineDays}/365 days`,
      liquidity: 'Withdraw anytime, no penalty',
      sourceCheckedAt: new Date().toISOString(),
    },
  } satisfies Route];
}

// ── self-check ──────────────────────────────────────────────────────────────
function fakeYield(label: string, days: number, yieldPct: number): TreasuryBillYield {
  return { label, days, yieldPct, yieldLabel: `${label} coupon-equivalent yield`, yieldAsOf: '2026-01-01', yieldSource: 'U.S. Treasury', yieldSourceUrl: 'https://example.com' };
}

export function __selfCheck(): void {
  const yields = [fakeYield('4-week T-bill', 28, 4), fakeYield('13-week T-bill', 91, 4.2)];

  const [route] = buildSavingsAccountRoute({ yields, balance: 10000, target: 100, deadlineDays: 365 });
  console.assert(route.category === 'Savings & Treasuries' && route.riskLevel === 1 && route.lossProfile === 'partial', 'HYSA route is a safe, capital-preserved Savings & Treasuries route');
  console.assert(route.maturesInDays == null, 'no fixed maturity — a savings account is withdrawable anytime');
  console.assert(route.investmentFacts?.yieldPct === 4.2, 'uses the 13-week T-bill yield, not the 4-week');
  console.assert(/proxy/i.test(route.investmentFacts?.yieldLabel ?? ''), 'discloses this is a proxy, not a real bank quote');
  console.assert(route.meetsTarget === true, '$10,000 × 4.2%/yr clears a $100 target over a year');

  console.assert(buildSavingsAccountRoute({ yields, balance: 0, target: 100, deadlineDays: 365 }).length === 0, 'zero balance → no route');
  console.assert(buildSavingsAccountRoute({ yields: [], balance: 10000, target: 100, deadlineDays: 365 }).length === 0, 'no 13-week yield available → no fabricated route');
}
