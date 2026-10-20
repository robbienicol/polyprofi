import type { OptionChain, OptionContract, OptionExpiry } from '@/api/client/options-chain-types';
import type { OptionPosition, OptionStrategy } from '@/types/routes';

/** Target deltas for each leg — the conventional strikes for each strategy. */
const LONG_DELTA = 0.3;
const SPREAD_BUY_DELTA = 0.5;
const SPREAD_SELL_DELTA = 0.25;
const SHORT_PUT_DELTA = 0.2;
const COVERED_CALL_DELTA = 0.25;
const CONDOR_SHORT_DELTA = 0.2;
const CONDOR_WING_DELTA = 0.1;
const COLLAR_DELTA = 0.25;
/** A bought option's win is defined as doubling the premium. */
const LONG_WIN_MULTIPLE = 2;
const SHARES_PER_CONTRACT = 100;

/**
 * Calendar days until the 4pm ET close on that date (20:00 UTC is close enough
 * year-round), rounded — so a contract expiring in a few hours counts as 0 and is
 * skipped rather than priced off a last-hours IV that means nothing.
 */
export function daysUntilExpiry(isoDate: string, now: number): number {
  return Math.round((Date.parse(`${isoDate}T20:00:00Z`) - now) / 86_400_000);
}

export interface Candidate {
  position: OptionPosition;
  /** IV of the leg whose strike sets the win level — the distribution the market prices there. */
  iv: number;
  /** IV at the upper edge, for a range ('between') win. */
  upperIv?: number;
}

/** Profit or loss on one lot, in dollars, if the underlying closes at `price` on expiry. */
export function payoffAtExpiry(position: OptionPosition, price: number): number {
  return position.legs.reduce((sum, leg) => {
    const value = leg.type === 'shares'
      ? price
      : leg.type === 'call' ? Math.max(0, price - leg.strike) : Math.max(0, leg.strike - price);
    return sum + (leg.action === 'buy' ? value - leg.price : leg.price - value) * SHARES_PER_CONTRACT;
  }, 0);
}

export function expiryForDeadline(expiries: OptionExpiry[], deadlineDays: number, now: number): OptionExpiry | null {
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

export function longOption(chain: OptionChain, expiry: OptionExpiry, type: 'call' | 'put'): Candidate | null {
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

export function bullCallSpread(chain: OptionChain, expiry: OptionExpiry): Candidate | null {
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

export function bearPutSpread(chain: OptionChain, expiry: OptionExpiry): Candidate | null {
  const long = nearestDelta(expiry.contracts, 'put', SPREAD_BUY_DELTA);
  const short = nearestDelta(expiry.contracts.filter((c) => long != null && c.strike < long.strike), 'put', SPREAD_SELL_DELTA);
  if (!long || !short) return null;
  const debit = long.ask - short.bid;
  const width = long.strike - short.strike;
  if (debit <= 0 || debit >= width) return null;
  const lotCost = debit * SHARES_PER_CONTRACT;
  return {
    iv: short.iv,
    position: {
      ...basePosition(chain, expiry, 'bear-put-spread'),
      legs: [
        { action: 'buy', type: 'put', strike: long.strike, price: long.ask },
        { action: 'sell', type: 'put', strike: short.strike, price: short.bid },
      ],
      lotCost,
      winReturnRate: (width - debit) / debit,
      winLevel: short.strike,
      winDirection: 'below',
      maxLoss: lotCost,
    },
  };
}

/**
 * A range bet: sell a put and a call either side of the price, buy cheaper ones further
 * out so the loss is capped. Pays the credit if the stock finishes between the two sold
 * strikes. The stake is the most it can lose — what the broker holds against it.
 */
export function ironCondor(chain: OptionChain, expiry: OptionExpiry): Candidate | null {
  const below = expiry.contracts.filter((c) => c.strike < chain.price);
  const above = expiry.contracts.filter((c) => c.strike > chain.price);
  const shortPut = nearestDelta(below, 'put', CONDOR_SHORT_DELTA);
  const shortCall = nearestDelta(above, 'call', CONDOR_SHORT_DELTA);
  if (!shortPut || !shortCall) return null;
  const longPut = nearestDelta(below.filter((c) => c.strike < shortPut.strike), 'put', CONDOR_WING_DELTA);
  const longCall = nearestDelta(above.filter((c) => c.strike > shortCall.strike), 'call', CONDOR_WING_DELTA);
  if (!longPut || !longCall) return null;
  const credit = shortPut.bid + shortCall.bid - longPut.ask - longCall.ask;
  // Only one side can finish in the money, so the wider wing sets the most it can lose.
  const width = Math.max(shortPut.strike - longPut.strike, longCall.strike - shortCall.strike);
  const risk = width - credit;
  if (credit <= 0 || risk <= 0) return null;
  const lotCost = risk * SHARES_PER_CONTRACT;
  return {
    iv: shortPut.iv,
    upperIv: shortCall.iv,
    position: {
      ...basePosition(chain, expiry, 'iron-condor'),
      legs: [
        { action: 'buy', type: 'put', strike: longPut.strike, price: longPut.ask },
        { action: 'sell', type: 'put', strike: shortPut.strike, price: shortPut.bid },
        { action: 'sell', type: 'call', strike: shortCall.strike, price: shortCall.bid },
        { action: 'buy', type: 'call', strike: longCall.strike, price: longCall.ask },
      ],
      lotCost,
      winReturnRate: credit / risk,
      winLevel: shortPut.strike,
      winUpper: shortCall.strike,
      winDirection: 'between',
      maxLoss: lotCost,
    },
  };
}

export function cashSecuredPut(chain: OptionChain, expiry: OptionExpiry): Candidate | null {
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

export function coveredCall(chain: OptionChain, expiry: OptionExpiry): Candidate | null {
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

/**
 * Shares with a floor: buy 100 shares, buy a put below the price, and pay for it by
 * selling a call above. However far the stock falls, the put sells the shares at its
 * strike, so a loss still hands back most of the money.
 */
export function collar(chain: OptionChain, expiry: OptionExpiry): Candidate | null {
  const put = nearestDelta(expiry.contracts.filter((c) => c.strike < chain.price), 'put', COLLAR_DELTA);
  const call = nearestDelta(expiry.contracts.filter((c) => c.strike > chain.ask), 'call', COLLAR_DELTA);
  if (!put || !call) return null;
  const netCost = chain.ask + put.ask - call.bid;
  const floorLoss = netCost - put.strike;
  if (floorLoss <= 0 || call.strike <= netCost) return null;
  const lotCost = netCost * SHARES_PER_CONTRACT;
  return {
    iv: call.iv,
    position: {
      ...basePosition(chain, expiry, 'collar'),
      legs: [
        { action: 'buy', type: 'shares', strike: chain.ask, price: chain.ask },
        { action: 'buy', type: 'put', strike: put.strike, price: put.ask },
        { action: 'sell', type: 'call', strike: call.strike, price: call.bid },
      ],
      lotCost,
      winReturnRate: (call.strike - netCost) / netCost,
      winLevel: call.strike,
      winDirection: 'above',
      maxLoss: floorLoss * SHARES_PER_CONTRACT,
    },
  };
}
