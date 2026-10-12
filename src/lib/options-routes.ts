import type { OptionChain, OptionContract, OptionExpiry } from '@/api/client/options-chain-types';
import { probabilityAboveAtExpiry } from '@/lib/volatility-probability';
import type { OptionLeg, OptionPosition, OptionStrategy, Route } from '@/types/routes';

/**
 * Options routes, built from live CBOE chains (see /api/options-chains) — five
 * strategies on each liquid ticker, so ~60 candidates that rank through the same
 * Pathey score as everything else.
 *
 * Honesty rules, the same as every other builder:
 *   - Real contracts only. Every leg is a strike and expiry that trades today, bought
 *     at the ask and sold at the bid — never at mid, which nobody fills at.
 *   - The probability is the options market's own: risk-neutral N(d2) off that
 *     contract's implied volatility. It is what the market has priced in, not a view.
 *   - One route = one defined win: the payoff if the underlying finishes past a
 *     stated level at expiry. Anything short of it pays less or loses.
 *   - Whole contracts. The stake is always a multiple of one lot's cost.
 *   - The expiry is the last one on or before the goal's deadline; a deadline with no
 *     expiry inside it gets no options routes rather than one that runs late.
 */

interface StrategySpec {
  strategy: OptionStrategy;
  emoji: string;
  riskLevel: number;
  lossProfile: Route['lossProfile'];
}

const STRATEGIES: Record<OptionStrategy, StrategySpec> = {
  'long-call': { strategy: 'long-call', emoji: '🎯', riskLevel: 5, lossProfile: 'binary' },
  'long-put': { strategy: 'long-put', emoji: '🔻', riskLevel: 5, lossProfile: 'binary' },
  'bull-call-spread': { strategy: 'bull-call-spread', emoji: '📐', riskLevel: 4, lossProfile: 'binary' },
  'cash-secured-put': { strategy: 'cash-secured-put', emoji: '💰', riskLevel: 3, lossProfile: 'partial' },
  'covered-call': { strategy: 'covered-call', emoji: '🛡️', riskLevel: 3, lossProfile: 'partial' },
};

/** Target deltas for each leg — the conventional strikes for each strategy. */
const LONG_DELTA = 0.3;
const SPREAD_BUY_DELTA = 0.5;
const SPREAD_SELL_DELTA = 0.25;
const SHORT_PUT_DELTA = 0.2;
const COVERED_CALL_DELTA = 0.25;
/** A bought option's win is defined as doubling the premium. */
const LONG_WIN_MULTIPLE = 2;
/** Below this the route is noise, not a plan. */
const MIN_PROBABILITY = 1;
const SHARES_PER_CONTRACT = 100;

/**
 * Calendar days until the 4pm ET close on that date (20:00 UTC is close enough
 * year-round), rounded — so a contract expiring in a few hours counts as 0 and is
 * skipped rather than priced off a last-hours IV that means nothing.
 */
export function daysUntilExpiry(isoDate: string, now: number): number {
  return Math.round((Date.parse(`${isoDate}T20:00:00Z`) - now) / 86_400_000);
}

export function buildOptionsRoutes({
  chains,
  balance,
  target,
  deadlineDays,
  riskFreePct,
  now = Date.now(),
}: {
  chains: OptionChain[];
  balance: number;
  target: number;
  deadlineDays: number;
  riskFreePct: number;
  now?: number;
}): Route[] {
  if (balance <= 0 || target <= 0) return [];
  return chains.flatMap((chain) => {
    const expiry = expiryForDeadline(chain.expiries, deadlineDays, now);
    if (!expiry) return [];
    const days = daysUntilExpiry(expiry.date, now);
    const years = days / 365;
    const positions = [
      longOption(chain, expiry, 'call'),
      longOption(chain, expiry, 'put'),
      bullCallSpread(chain, expiry),
      cashSecuredPut(chain, expiry),
      coveredCall(chain, expiry),
    ];
    return positions.flatMap((candidate) => {
      if (!candidate) return [];
      const probability = winProbability(chain.price, candidate, years, riskFreePct);
      if (probability == null || probability < MIN_PROBABILITY) return [];
      return [toRoute(candidate.position, candidate.iv, probability, days, balance, target)];
    });
  });
}

interface Candidate {
  position: OptionPosition;
  /** IV of the leg whose strike sets the win level — the distribution the market prices there. */
  iv: number;
}

function expiryForDeadline(expiries: OptionExpiry[], deadlineDays: number, now: number): OptionExpiry | null {
  const inside = expiries
    .map((expiry) => ({ expiry, days: daysUntilExpiry(expiry.date, now) }))
    .filter((entry) => entry.days >= 1 && entry.days <= deadlineDays)
    .sort((a, b) => a.days - b.days);
  return inside.at(-1)?.expiry ?? null;
}

function nearestDelta(contracts: OptionContract[], type: OptionContract['type'], absDelta: number): OptionContract | null {
  let best: OptionContract | null = null;
  for (const contract of contracts) {
    if (contract.type !== type || contract.delta === 0) continue;
    if (!best || Math.abs(Math.abs(contract.delta) - absDelta) < Math.abs(Math.abs(best.delta) - absDelta)) best = contract;
  }
  return best;
}

function basePosition(chain: OptionChain, expiry: OptionExpiry, strategy: OptionStrategy): Pick<OptionPosition, 'strategy' | 'underlying' | 'underlyingPrice' | 'expiry' | 'quotedAt'> {
  return { strategy, underlying: chain.symbol, underlyingPrice: chain.price, expiry: expiry.date, quotedAt: chain.asOf };
}

function longOption(chain: OptionChain, expiry: OptionExpiry, type: 'call' | 'put'): Candidate | null {
  const contract = nearestDelta(expiry.contracts, type, LONG_DELTA);
  if (!contract) return null;
  const premium = contract.ask;
  const winLevel = type === 'call'
    ? contract.strike + LONG_WIN_MULTIPLE * premium
    : contract.strike - LONG_WIN_MULTIPLE * premium;
  if (winLevel <= 0) return null;
  const lotCost = premium * SHARES_PER_CONTRACT;
  return {
    iv: contract.iv,
    position: {
      ...basePosition(chain, expiry, type === 'call' ? 'long-call' : 'long-put'),
      legs: [{ action: 'buy', type, strike: contract.strike, price: premium }],
      lotCost,
      winReturnRate: LONG_WIN_MULTIPLE - 1,
      winLevel,
      winDirection: type === 'call' ? 'above' : 'below',
      maxLoss: lotCost,
    },
  };
}

function bullCallSpread(chain: OptionChain, expiry: OptionExpiry): Candidate | null {
  const long = nearestDelta(expiry.contracts, 'call', SPREAD_BUY_DELTA);
  const short = nearestDelta(expiry.contracts.filter((c) => long != null && c.strike > long.strike), 'call', SPREAD_SELL_DELTA);
  if (!long || !short) return null;
  const debit = long.ask - short.bid;
  const width = short.strike - long.strike;
  if (debit <= 0 || debit >= width) return null;
  const lotCost = debit * SHARES_PER_CONTRACT;
  return {
    iv: short.iv,
    position: {
      ...basePosition(chain, expiry, 'bull-call-spread'),
      legs: [
        { action: 'buy', type: 'call', strike: long.strike, price: long.ask },
        { action: 'sell', type: 'call', strike: short.strike, price: short.bid },
      ],
      lotCost,
      winReturnRate: (width - debit) / debit,
      winLevel: short.strike,
      winDirection: 'above',
      maxLoss: lotCost,
    },
  };
}

function cashSecuredPut(chain: OptionChain, expiry: OptionExpiry): Candidate | null {
  const put = nearestDelta(expiry.contracts.filter((c) => c.strike < chain.price), 'put', SHORT_PUT_DELTA);
  if (!put) return null;
  // The broker holds the full strike in cash; the premium is the whole return on it.
  const lotCost = put.strike * SHARES_PER_CONTRACT;
  return {
    iv: put.iv,
    position: {
      ...basePosition(chain, expiry, 'cash-secured-put'),
      legs: [{ action: 'sell', type: 'put', strike: put.strike, price: put.bid }],
      lotCost,
      winReturnRate: put.bid / put.strike,
      winLevel: put.strike,
      winDirection: 'above',
      // Assigned at the strike on a stock that went to zero, less the premium kept.
      maxLoss: (put.strike - put.bid) * SHARES_PER_CONTRACT,
    },
  };
}

function coveredCall(chain: OptionChain, expiry: OptionExpiry): Candidate | null {
  const call = nearestDelta(expiry.contracts.filter((c) => c.strike > chain.ask), 'call', COVERED_CALL_DELTA);
  if (!call) return null;
  const netCost = chain.ask - call.bid;
  if (netCost <= 0) return null;
  const lotCost = netCost * SHARES_PER_CONTRACT;
  return {
    iv: call.iv,
    position: {
      ...basePosition(chain, expiry, 'covered-call'),
      legs: [
        { action: 'buy', type: 'shares', strike: chain.ask, price: chain.ask },
        { action: 'sell', type: 'call', strike: call.strike, price: call.bid },
      ],
      lotCost,
      winReturnRate: (call.strike - netCost) / netCost,
      winLevel: call.strike,
      winDirection: 'above',
      maxLoss: lotCost,
    },
  };
}

function winProbability(spot: number, candidate: Candidate, years: number, riskFreePct: number): number | null {
  const { winLevel, winDirection } = candidate.position;
  const above = probabilityAboveAtExpiry(spot, winLevel, candidate.iv, years, riskFreePct);
  if (above == null) return null;
  return Math.round((winDirection === 'above' ? above : 100 - above) * 10) / 10;
}

const STRATEGY_NAMES: Record<OptionStrategy, string> = {
  'long-call': 'Call',
  'long-put': 'Put',
  'bull-call-spread': 'Call spread',
  'cash-secured-put': 'Cash-secured put',
  'covered-call': 'Covered call',
};

function toRoute(position: OptionPosition, iv: number, probability: number, days: number, balance: number, target: number): Route {
  const spec = STRATEGIES[position.strategy];
  const lots = Math.floor(balance / position.lotCost);
  const expectedReturn = Math.round(lots * position.lotCost * position.winReturnRate);
  const { underlying: ticker } = position;
  const date = formatExpiry(position.expiry);
  const level = money(position.winLevel);
  const spot = money(position.underlyingPrice);
  const lot = money(position.lotCost);
  const winPct = Math.round(position.winReturnRate * 1000) / 10;
  const direction = position.winDirection === 'above' ? 'above' : 'below';

  return {
    id: `opt-${ticker.toLowerCase()}-${position.strategy}-${position.expiry}`,
    category: 'Options',
    emoji: spec.emoji,
    description: `${describeLegs(position)} — ${lot} per contract. Pays +${winPct}% if ${ticker} (now ${spot}) closes ${direction} ${level} on ${date}. The options market prices that at ~${probability.toFixed(0)}%.`,
    riskLevel: spec.riskLevel,
    probability,
    expectedReturn,
    platform: 'Options brokerage',
    strategy: strategyCopy(position),
    line: `${ticker} ${STRATEGY_NAMES[position.strategy]} · ${date}`,
    maturesInDays: days,
    lossProfile: spec.lossProfile,
    meetsTarget: expectedReturn >= target,
    optionPosition: position,
    investmentFacts: {
      projectionBasis: `Risk-neutral P(${ticker} ${direction} ${level} on ${date}) from the contract's ${(iv * 100).toFixed(0)}% implied volatility; legs priced at the ask/bid, whole contracts only`,
      liquidity: 'Listed options — bought at the ask, sold at the bid, ~15-min delayed CBOE quotes',
      sourceCheckedAt: position.quotedAt,
    },
  };
}

function describeLegs(position: OptionPosition): string {
  const { underlying: ticker, legs } = position;
  const date = formatExpiry(position.expiry);
  const leg = (l: OptionLeg) => `${l.action === 'buy' ? 'buy' : 'sell'} the ${money(l.strike)} ${l.type}`;
  switch (position.strategy) {
    case 'long-call':
    case 'long-put':
      return `Buy 1 ${ticker} ${money(legs[0].strike)} ${legs[0].type} expiring ${date} at ${money(legs[0].price)}`;
    case 'bull-call-spread':
      return `${ticker} ${date} call spread: ${leg(legs[0])}, ${leg(legs[1])}`;
    case 'cash-secured-put':
      return `Sell 1 ${ticker} ${money(legs[0].strike)} put expiring ${date} for ${money(legs[0].price)}, cash set aside to buy the shares`;
    case 'covered-call':
      return `Buy 100 ${ticker} shares and sell the ${money(legs[1].strike)} call expiring ${date} for ${money(legs[1].price)}`;
  }
}

function strategyCopy(position: OptionPosition): string {
  const { underlying: ticker } = position;
  const level = money(position.winLevel);
  const maxLoss = money(position.maxLoss);
  switch (position.strategy) {
    case 'long-call':
      return `A bet that ${ticker} rises past ${level} by expiry. Below the strike the contract expires worthless and you lose the full ${maxLoss} premium; between the strike and ${level} you get some of it back. Time decay works against you every day.`;
    case 'long-put':
      return `A bet that ${ticker} falls below ${level} by expiry. Above the strike the contract expires worthless and you lose the full ${maxLoss} premium. Time decay works against you every day.`;
    case 'bull-call-spread':
      return `A capped bet that ${ticker} rises: selling the higher call pays for part of the lower one. Above ${level} you collect the full spread; below the lower strike you lose the ${maxLoss} paid. Cheaper than a plain call, with less upside.`;
    case 'cash-secured-put':
      return `You're paid now to agree to buy 100 ${ticker} shares at ${level}. If ${ticker} stays above it, you keep the premium and the cash. If it drops below, you buy the shares at ${level} — you still own them, but at a loss on paper until they recover.`;
    case 'covered-call':
      return `You own 100 ${ticker} shares and sell someone the right to buy them at ${level}. The premium cushions a small drop; above ${level} your shares are called away at that price, so the gain is capped. Below it you keep the shares and whatever they're worth.`;
  }
}

function money(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: value < 1000 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

function formatExpiry(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// ── self-check ──────────────────────────────────────────────────────────────
export function __selfCheck(): void {
  const now = Date.parse('2026-09-30T15:00:00Z');
  const contract = (type: 'call' | 'put', strike: number, bid: number, ask: number, delta: number): OptionContract => ({
    type, strike, bid, ask, iv: 0.3, delta, openInterest: 1000,
  });
  const chain: OptionChain = {
    symbol: 'TEST',
    price: 100,
    ask: 100.05,
    asOf: '2026-09-30 15:00:00',
    expiries: [
      {
        date: '2026-10-23',
        contracts: [
          contract('call', 100, 3.4, 3.5, 0.52),
          contract('call', 105, 1.6, 1.7, 0.3),
          contract('call', 108, 0.9, 1.0, 0.22),
          contract('put', 95, 1.1, 1.2, -0.25),
          contract('put', 92, 0.6, 0.7, -0.18),
        ],
      },
      { date: '2027-01-15', contracts: [contract('call', 110, 2, 2.1, 0.3)] },
    ],
  };
  const routes = buildOptionsRoutes({ chains: [chain], balance: 20_000, target: 500, deadlineDays: 30, riskFreePct: 4, now });

  console.assert(routes.length === 5, 'all five strategies built from one liquid expiry');
  console.assert(routes.every((r) => r.optionPosition?.expiry === '2026-10-23'), 'uses the last expiry inside the deadline, never a later one');
  console.assert(buildOptionsRoutes({ chains: [chain], balance: 20_000, target: 500, deadlineDays: 7, riskFreePct: 4, now }).length === 0, 'no expiry inside the deadline → no routes');

  const call = routes.find((r) => r.optionPosition?.strategy === 'long-call')!;
  console.assert(call.optionPosition!.legs[0].strike === 105 && call.optionPosition!.legs[0].price === 1.7, 'the long call is bought at the ask, at ~0.30 delta');
  console.assert(call.optionPosition!.lotCost === 170, 'one contract is 100 shares');
  console.assert(Math.abs(call.optionPosition!.winLevel - 108.4) < 1e-9, 'win level is strike + 2× premium');

  const spread = routes.find((r) => r.optionPosition?.strategy === 'bull-call-spread')!;
  const debit = 3.5 - 0.9;
  console.assert(Math.abs(spread.optionPosition!.lotCost - debit * 100) < 1e-9, 'spread debit is long ask minus short bid');
  console.assert(Math.abs(spread.optionPosition!.winReturnRate - (8 - debit) / debit) < 1e-9, 'spread max profit is width minus debit');

  const csp = routes.find((r) => r.optionPosition?.strategy === 'cash-secured-put')!;
  console.assert(csp.optionPosition!.legs[0].strike === 92 && csp.optionPosition!.lotCost === 9200, 'CSP ties up the full strike, at ~0.20 delta');
  console.assert(csp.lossProfile === 'partial' && call.lossProfile === 'binary', 'selling premium keeps the shares; a bought option can expire worthless');

  const cc = routes.find((r) => r.optionPosition?.strategy === 'covered-call')!;
  console.assert(Math.abs(cc.optionPosition!.lotCost - (100.05 - 0.9) * 100) < 1e-9, 'covered call pays the share ask, less the call bid');

  const put = routes.find((r) => r.optionPosition?.strategy === 'long-put')!;
  console.assert(put.optionPosition!.winDirection === 'below' && Math.abs(put.optionPosition!.winLevel - 92.6) < 1e-9, 'a put wins below strike − 2× premium');
  console.assert(csp.probability > call.probability, 'selling an OTM put is likelier to pay than buying an OTM call');
}
