/**
 * Calibrated baseline playbook.
 * Given a return target and timeframe, returns the statistically-best vehicle(s)
 * and their hit probability — independent of live picks or risk appetite.
 * These ALWAYS get surfaced so the feed is never empty and always grounded in
 * what's actually achievable for the goal.
 *
 * Source: hand-tuned matrix (target% × timeframe). prob is 0–100; 0.5 means "<1%".
 *
 * riskLevel/lossProfile for these vehicles are fixed here (VEHICLE_META), not left to the
 * LLM — VOO must rank as low-risk every single run, not whichever risk level GPT-4o
 * happens to guess that day.
 */
import { Route } from '@/types/routes';
import { StockQuote } from '@/api/client/market-data';
import { probabilityOfTargetMove } from '@/lib/volatility-probability';

interface PlaybookPick {
  vehicle: string;
  probability: number;
}
export interface PlaybookCell {
  best: PlaybookPick;
  second: PlaybookPick;
}

// Column order per row: [day, week, month, year, fiveYears]
type Cell = [string, number]; // [vehicle, prob]
interface Row {
  best: [Cell, Cell, Cell, Cell, Cell];
  second: [Cell, Cell, Cell, Cell, Cell];
}

const TARGETS = [1, 3, 5, 10, 20, 50, 100, 300, 500] as const;
type Col = 0 | 1 | 2 | 3 | 4;

const MATRIX: Record<(typeof TARGETS)[number], Row> = {
  1: {
    best: [['Polymarket', 85], ['Polymarket', 85], ['T-bill / HYSA', 99], ['T-bill / HYSA', 99], ['T-bill / HYSA', 99]],
    second: [['Polymarket', 80], ['Polymarket', 80], ['Selling premium', 92], ['Selling premium', 92], ['Selling premium', 95]],
  },
  3: {
    best: [['Polymarket', 75], ['Polymarket', 75], ['Selling premium', 72], ['T-bill / HYSA', 95], ['Broad ETF', 92]],
    second: [['Polymarket', 65], ['Polymarket', 65], ['Polymarket', 65], ['Selling premium', 88], ['Selling premium', 90]],
  },
  5: {
    best: [['Polymarket', 55], ['Polymarket', 58], ['Selling premium', 65], ['Broad ETF', 72], ['Broad ETF', 85]],
    second: [['Polymarket', 50], ['Selling premium', 55], ['Growth stocks', 55], ['Selling premium', 68], ['Selling premium', 82]],
  },
  10: {
    best: [['OTM options', 25], ['OTM options', 28], ['Growth stocks', 40], ['Broad ETF', 62], ['Broad ETF', 78]],
    second: [['Growth stocks', 20], ['Growth stocks', 22], ['OTM options', 35], ['Growth stocks', 50], ['Growth stocks', 72]],
  },
  20: {
    best: [['OTM options', 10], ['OTM options', 12], ['Growth stocks', 25], ['Growth stocks', 35], ['Broad ETF', 65]],
    second: [['OTM options', 8], ['Growth stocks', 10], ['OTM options', 18], ['Growth stocks', 30], ['Growth stocks', 60]],
  },
  50: {
    best: [['OTM options', 4], ['OTM options', 6], ['OTM options', 12], ['Growth stocks', 20], ['Growth stocks', 45]],
    second: [['OTM options', 3], ['OTM options', 5], ['OTM options', 8], ['Growth stocks', 15], ['Broad ETF', 40]],
  },
  100: {
    best: [['OTM options', 2], ['OTM options', 3], ['OTM options', 6], ['OTM options', 12], ['Growth stocks', 30]],
    second: [['OTM options', 1], ['OTM options', 2], ['OTM options', 4], ['Growth stocks', 8], ['Broad ETF', 25]],
  },
  300: {
    best: [['OTM options', 0.5], ['OTM options', 1], ['OTM options', 2], ['OTM options', 5], ['OTM options', 12]],
    second: [['OTM options', 0.5], ['OTM options', 0.5], ['OTM options', 1], ['OTM options', 3], ['OTM options', 8]],
  },
  500: {
    best: [['OTM options', 0.5], ['OTM options', 0.5], ['OTM options', 1], ['OTM options', 3], ['OTM options', 8]],
    second: [['OTM options', 0.5], ['OTM options', 0.5], ['OTM options', 0.5], ['OTM options', 1], ['OTM options', 5]],
  },
};

function timeframeToCol(timeframe: string): Col {
  switch (timeframe) {
    case 'today': return 0;
    case 'week': return 1;
    case 'month': return 2;
    case '3months': return 2; // approximated to the 1-month column (nearest conservative)
    case '1year': return 3;
    case '5years': return 4;
    default: return 1;
  }
}

// Pick the smallest target bucket >= the needed return, so we never overstate odds.
export function targetBucket(returnPct: number): (typeof TARGETS)[number] {
  for (const t of TARGETS) if (returnPct <= t) return t;
  return 500;
}

/** Trading-day horizon per timeframe — single source of truth (anthropic.ts imports this too). */
export function timeframeTradingDays(timeframe: string): number {
  switch (timeframe) {
    case 'today': return 1;
    case 'week': return 5;
    case 'month': return 21;
    case '3months': return 63;
    case '1year': return 252;
    case '5years': return 1260;
    default: return 5;
  }
}

/** Calendar-day horizon per timeframe — used for "matures in Nd" when we lack a real date. */
export function timeframeCalendarDays(timeframe: string): number {
  switch (timeframe) {
    case 'today': return 1;
    case 'week': return 7;
    case 'month': return 30;
    case '3months': return 90;
    case '1year': return 365;
    case '5years': return 1825;
    default: return 7;
  }
}

export function getPlaybook(returnPct: number, timeframe: string): PlaybookCell {
  const row = MATRIX[targetBucket(returnPct)];
  const col = timeframeToCol(timeframe);
  const [bv, bp] = row.best[col];
  const [sv, sp] = row.second[col];
  return { best: { vehicle: bv, probability: bp }, second: { vehicle: sv, probability: sp } };
}

const pct = (p: number) => (p < 1 ? '<1%' : `${p}%`);

export function formatPlaybook(cell: PlaybookCell, returnPct: number, timeframeLabel: string): string {
  return `For a ${returnPct.toFixed(1)}% return over ${timeframeLabel}, the math-calibrated vehicles are:
  1) ${cell.best.vehicle} — ~${pct(cell.best.probability)} hit probability
  2) ${cell.second.vehicle} — ~${pct(cell.second.probability)} hit probability
These two are injected automatically by the app with fixed risk levels — do NOT output them yourself or invent your own version of them. Use them only as the bar your other picks must justify: anything riskier than these baselines needs a clearly higher probability or a real catalyst to earn a spot above them.`;
}

interface VehicleMeta {
  riskLevel: number; // 1 (safest) – 5 (riskiest), fixed — never LLM-assigned for these vehicles
  lossProfile: 'binary' | 'partial';
  emoji: string;
  category: string;
  platform: string;
}

// Allowed universe only: Polymarket + Stocks/ETFs + Savings & Treasuries. No sports/crypto.
const VEHICLE_META: Record<string, VehicleMeta> = {
  'T-bill / HYSA': { riskLevel: 1, lossProfile: 'partial', emoji: '🏦', category: 'Savings & Treasuries', platform: 'Treasury Direct / high-yield savings' },
  'Broad ETF': { riskLevel: 1, lossProfile: 'partial', emoji: '📈', category: 'Stocks & ETFs', platform: 'VOO (brokerage)' },
  'Selling premium': { riskLevel: 2, lossProfile: 'partial', emoji: '💰', category: 'Stocks & ETFs', platform: 'Options brokerage' },
  Polymarket: { riskLevel: 2, lossProfile: 'binary', emoji: '🔮', category: 'Polymarket', platform: 'Polymarket' },
  'Growth stocks': { riskLevel: 3, lossProfile: 'partial', emoji: '🚀', category: 'Stocks & ETFs', platform: 'Brokerage' },
  'OTM options': { riskLevel: 5, lossProfile: 'binary', emoji: '🎯', category: 'Stocks & ETFs', platform: 'Options brokerage' },
};

export interface PlaybookLiveData {
  stocks: StockQuote[];
}

const GROWTH_TICKERS = new Set(['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'META']);

/** Concretizes a category-level vehicle into a real, currently-live instrument — never fabricated; falls back to the generic vehicle name when live data is unavailable. */
function concreteInstrument(
  vehicle: string,
  live: PlaybookLiveData | undefined,
  returnPct: number,
  timeframe: string
): { name: string; detail: string } | null {
  if (!live) return null;
  const { stocks } = live;

  if (vehicle === 'Broad ETF') {
    const spy = stocks.find((s) => s.symbol === 'SPY');
    return { name: 'VOO', detail: spy ? `tracks the S&P 500 — SPY currently $${spy.price.toFixed(2)}` : 'tracks the S&P 500' };
  }
  if (vehicle === 'T-bill / HYSA') {
    const irx = stocks.find((s) => s.symbol === '^IRX');
    return irx
      ? { name: '13-week T-bill', detail: `currently yielding ~${irx.price.toFixed(2)}% (^IRX) — a HYSA at a similar APY works too` }
      : null;
  }
  if (vehicle === 'Growth stocks' || vehicle === 'OTM options' || vehicle === 'Selling premium') {
    const horizonTradingDays = timeframeTradingDays(timeframe);
    const candidates = stocks
      .filter((s) => GROWTH_TICKERS.has(s.symbol))
      .map((s) => ({ s, p: probabilityOfTargetMove(s.dailyVol, returnPct, horizonTradingDays) }))
      .filter((c): c is { s: StockQuote; p: number } => c.p != null)
      .sort((a, b) => b.p - a.p);
    const best = candidates[0]?.s;
    if (!best) return null;
    const action = vehicle === 'OTM options' ? 'OTM calls on' : vehicle === 'Selling premium' ? 'Cash-secured puts/covered calls on' : '';
    return { name: action ? `${action} ${best.symbol}` : best.symbol, detail: `$${best.price.toFixed(2)}, highest realized-vol fit for this target among tracked growth names` };
  }
  return null; // Polymarket: no live instrument to name here, stays generic — never fabricate a fake market
}

function pickToRoute(pick: PlaybookPick, id: string, returnPct: number, target: number, timeframe: string, live?: PlaybookLiveData): Route {
  const meta = VEHICLE_META[pick.vehicle] ?? {
    riskLevel: 3, lossProfile: 'partial', emoji: '📊', category: 'Stocks & ETFs', platform: 'Brokerage',
  };
  const concrete = concreteInstrument(pick.vehicle, live, returnPct, timeframe);
  const named = concrete?.name ?? pick.vehicle;
  return {
    id,
    category: meta.category,
    emoji: meta.emoji,
    description: concrete
      ? `Put your $${Math.round(target / (returnPct / 100))} in ${named} (${concrete.detail}) — clears ${returnPct.toFixed(1)}% ~${pct(pick.probability)} of the time.`
      : `Put your $${Math.round(target / (returnPct / 100))} in ${pick.vehicle} — clears ${returnPct.toFixed(1)}% ~${pct(pick.probability)} of the time.`,
    riskLevel: meta.riskLevel,
    probability: pick.probability,
    expectedReturn: target,
    lossProfile: meta.lossProfile,
    meetsTarget: true,
    maturesInDays: timeframeCalendarDays(timeframe),
    platform: meta.platform,
    strategy: concrete
      ? `Allocate to ${named} for the full timeframe — the statistically safest path to this goal, not a speculative pick.`
      : `Allocate to ${pick.vehicle} for the full timeframe — the statistically safest path to this goal, not a speculative pick.`,
  };
}

/** The two baseline routes for this goal, with deterministic riskLevel/lossProfile — never LLM-assigned. */
export function playbookRoutes(returnPct: number, timeframe: string, target: number, live?: PlaybookLiveData): Route[] {
  const cell = getPlaybook(returnPct, timeframe);
  return [
    pickToRoute(cell.best, 'playbook-best', returnPct, target, timeframe, live),
    pickToRoute(cell.second, 'playbook-second', returnPct, target, timeframe, live),
  ];
}

/**
 * What the calibrated baseline can actually deliver for this goal — the floor/ceiling
 * a quiz-side risk filter must never be stricter than, or it ends up rejecting the app's
 * own grounded recommendation (e.g. requiring 30% min probability when the realistic
 * path to 100%/month is OTM options at ~4%).
 */
export function playbookRiskBounds(returnPct: number, timeframe: string): { minProbability: number; maxRiskLevel: number } {
  const cell = getPlaybook(returnPct, timeframe);
  const metas = [cell.best, cell.second].map((p) => VEHICLE_META[p.vehicle] ?? { riskLevel: 3 });
  return {
    minProbability: Math.min(cell.best.probability, cell.second.probability),
    maxRiskLevel: Math.max(...metas.map((m) => m.riskLevel)),
  };
}

// ── self-check ──────────────────────────────────────────────────────────────
export function __selfCheck(): void {
  const a = getPlaybook(1, '1year');
  console.assert(a.best.vehicle === 'T-bill / HYSA' && a.best.probability === 99, '1%/1yr → T-bill 99%');
  const b = getPlaybook(2, 'week'); // 2% rounds up to 3% bucket
  console.assert(b.best.vehicle === 'Polymarket' && b.best.probability === 75, '2%/week → 3%-bucket Polymarket');
  const c = getPlaybook(100, 'today');
  console.assert(c.best.vehicle === 'OTM options' && c.best.probability === 2, '100%/day → OTM 2%');
  const d = getPlaybook(9999, '5years'); // clamps to 500 bucket
  console.assert(d.best.vehicle === 'OTM options', 'huge target clamps to 500 row (OTM options)');

  // every vehicle the matrix can yield must be in the allowed universe
  const allowed = new Set(['T-bill / HYSA', 'Broad ETF', 'Selling premium', 'Polymarket', 'Growth stocks', 'OTM options']);
  for (const t of TARGETS) {
    for (const cell of [...MATRIX[t].best, ...MATRIX[t].second]) {
      console.assert(allowed.has(cell[0]), `matrix vehicle "${cell[0]}" must be in the allowed universe`);
    }
  }

  // baselines must carry fixed, sane risk — never left blank or guessed
  const safe = playbookRoutes(1, '1year', 10);
  console.assert(safe[0].riskLevel === 1, 'T-bill/HYSA baseline is always riskLevel 1');
  const risky = playbookRoutes(9999, '5years', 10);
  console.assert(risky[0].riskLevel === 5, 'OTM options baseline is always riskLevel 5');
  console.assert(safe.every((r) => r.meetsTarget === true), 'baselines always meetsTarget');
  console.assert(safe[0].strategy.includes('T-bill / HYSA'), 'without live data, baseline stays generic');

  // with live data → must name a REAL fetched instrument, not the category label
  const mockLive: PlaybookLiveData = {
    stocks: [
      { symbol: 'NVDA', name: 'NVIDIA', price: 120, change: 1, changePct: 1, volume: 1, change1wPct: null, change1mPct: null, change3mPct: null, change1yPct: null, dailyVol: 0.03 },
      { symbol: 'AAPL', name: 'Apple', price: 200, change: 1, changePct: 1, volume: 1, change1wPct: null, change1mPct: null, change3mPct: null, change1yPct: null, dailyVol: 0.01 },
    ],
  };
  const concreteGrowth = playbookRoutes(10, 'today', 10, mockLive); // bucket-10/today best = OTM options
  console.assert(concreteGrowth[0].strategy.includes('NVDA'), 'higher dailyVol (NVDA) should be picked over AAPL for an aggressive target');
}
