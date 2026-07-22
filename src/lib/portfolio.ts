import { TrackedBet } from '@/types/bets';

/**
 * Portfolio math over tracked positions (panel 3 of the app spec).
 * Binary positions (sports, Polymarket) and partial positions (stocks, crypto,
 * treasuries) have different downside shapes, so EV is computed per profile:
 *   binary:  EV = p·return − (1−p)·stake   (lose the whole stake when wrong)
 *   partial: EV = p·return                 (capital roughly preserved when wrong)
 * Conservative mode = "assume stocks/crypto return zero": partial EV → 0.
 */

const BINARY_CATEGORIES = /sports|polymarket|parlay|options/i;

const isBinaryCategory = (category: string): boolean => BINARY_CATEGORIES.test(category);

interface ClassAllocation {
  category: string;
  staked: number;
  pct: number; // share of total staked, 0–100
  ev: number; // expected $ profit contribution
  evPct: number; // ev / total staked, 0–100 (contribution to weighted return)
}

export interface PortfolioStats {
  totalStaked: number;
  totalEv: number;
  weightedReturnPct: number; // ΣEV / Σstake × 100
  goalProbability: number; // stake-weighted avg hit probability, 0–100
  allocation: ClassAllocation[]; // sorted by staked desc
}

export function betEv(bet: TrackedBet, conservative: boolean): number {
  const p = bet.probability / 100;
  if (isBinaryCategory(bet.category)) {
    return p * bet.expectedReturn - (1 - p) * bet.amountWagered;
  }
  return conservative ? 0 : p * bet.expectedReturn;
}

export function portfolioStats(bets: TrackedBet[], conservative = false): PortfolioStats {
  const active = bets.filter((b) => b.status === 'active');
  const totalStaked = active.reduce((s, b) => s + b.amountWagered, 0);

  const byClass = new Map<string, { staked: number; ev: number }>();
  let totalEv = 0;
  let probWeighted = 0;
  for (const b of active) {
    const ev = betEv(b, conservative);
    totalEv += ev;
    probWeighted += b.probability * b.amountWagered;
    const c = byClass.get(b.category) ?? { staked: 0, ev: 0 };
    c.staked += b.amountWagered;
    c.ev += ev;
    byClass.set(b.category, c);
  }

  const allocation: ClassAllocation[] = [...byClass.entries()]
    .map(([category, { staked, ev }]) => ({
      category,
      staked,
      pct: totalStaked > 0 ? (staked / totalStaked) * 100 : 0,
      ev,
      evPct: totalStaked > 0 ? (ev / totalStaked) * 100 : 0,
    }))
    .sort((a, b) => b.staked - a.staked);

  return {
    totalStaked,
    totalEv,
    weightedReturnPct: totalStaked > 0 ? (totalEv / totalStaked) * 100 : 0,
    goalProbability: totalStaked > 0 ? probWeighted / totalStaked : 0,
    allocation,
  };
}

// ── self-check ──────────────────────────────────────────────────────────────
export function __selfCheck(): void {
  const mk = (over: Partial<TrackedBet>): TrackedBet => ({
    id: '1', category: 'Stocks & ETFs', emoji: '', description: '', platform: '', strategy: '',
    riskLevel: 1, probability: 50, expectedReturn: 10, amountWagered: 100, status: 'active',
    createdAt: '', ...over,
  });
  // binary: p=0.5, ret=100, stake=100 → EV = 50 − 50 = 0
  console.assert(betEv(mk({ category: 'Sports Betting', probability: 50, expectedReturn: 100 }), false) === 0, 'fair coin EV 0');
  // partial conservative → 0
  console.assert(betEv(mk({}), true) === 0, 'conservative partial EV 0');
  const s = portfolioStats([
    mk({ category: 'Polymarket', probability: 60, expectedReturn: 100, amountWagered: 100 }), // EV=60−40=20
    mk({ category: 'Stocks & ETFs', probability: 90, expectedReturn: 10, amountWagered: 100 }), // EV=9
  ]);
  console.assert(s.totalStaked === 200 && Math.abs(s.totalEv - 29) < 1e-9, 'EV sums');
  console.assert(Math.abs(s.weightedReturnPct - 14.5) < 1e-9, 'weighted return 14.5%');
  console.assert(Math.abs(s.goalProbability - 75) < 1e-9, 'stake-weighted prob 75');
}
