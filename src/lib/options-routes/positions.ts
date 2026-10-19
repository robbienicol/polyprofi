import type { OptionChain, OptionContract, OptionExpiry } from '@/api/client/options-chain-types';
import type { OptionPosition, OptionStrategy } from '@/types/routes';

/** Target deltas for each leg — the conventional strikes for each strategy. */
const LONG_DELTA = 0.3;
const SPREAD_BUY_DELTA = 0.5;
const SPREAD_SELL_DELTA = 0.25;
const SHORT_PUT_DELTA = 0.2;
const COVERED_CALL_DELTA = 0.25;
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
