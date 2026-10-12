import type { OptionChain, OptionContract, OptionExpiry } from '@/api/client/options-chain-types';
import { daysUntilExpiry } from '@/lib/options-routes';
import { isRecord, responseJson } from '@/lib/runtime-validation';

/**
 * Server-side fetch and trim of CBOE's delayed option chains, for /api/options-chains.
 * The raw files have no CORS headers and run to several MB each, so the device never
 * calls this directly.
 */

/**
 * The most liquid optionable names: three index ETFs and the mega-caps with the deepest
 * chains. Liquidity is the selection rule because the builder prices every buy at the
 * ask and every sale at the bid — a thin chain would make every route look worse than
 * the strategy is, or hide a spread the user would actually pay.
 */
const OPTIONS_UNIVERSE = ['SPY', 'QQQ', 'IWM', 'AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOGL', 'TSLA', 'JPM', 'AMD'];

/** Goal horizons in calendar days — the same values as timeframeCalendarDays. */
const HORIZON_DAYS = [1, 7, 30, 90, 365, 1825];

const MIN_OPEN_INTEREST = 100;
/** Widest bid/ask spread kept, as a fraction of mid. Wider than this and the quote isn't a price. */
const MAX_RELATIVE_SPREAD = 0.25;

/**
 * One ticker at a time, not all at once: each raw file is several MB, and holding a
 * dozen of them parsed in memory together is what a serverless worker runs out of.
 */
export async function fetchChains(): Promise<OptionChain[]> {
  const chains: OptionChain[] = [];
  for (const symbol of OPTIONS_UNIVERSE) {
    const chain = await fetchChain(symbol).catch(() => fetchChain(symbol)).catch((error: unknown) => {
      console.warn(`[api:options-chains] ${symbol}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    });
    if (chain) chains.push(chain);
    else console.warn(`[api:options-chains] ${symbol}: no usable contracts`);
  }
  return chains;
}

async function fetchChain(symbol: string): Promise<OptionChain | null> {
  const response = await fetch(`https://cdn.cboe.com/api/global/delayed_quotes/options/${symbol}.json`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`CBOE ${response.status}`);
  const payload = await responseJson(response);
  if (!isRecord(payload) || !isRecord(payload.data)) return null;
  const { data } = payload;
  const options = Array.isArray(data.options) ? data.options : [];
  const price = typeof data.current_price === 'number' ? data.current_price : null;
  if (price == null || price <= 0) return null;
  const ask = typeof data.ask === 'number' && data.ask > 0 ? data.ask : price;
  const asOf = typeof payload.timestamp === 'string' ? payload.timestamp : new Date().toISOString();

  const byDate = new Map<string, OptionContract[]>();
  for (const raw of options) {
    const contract = readContract(raw, symbol, price);
    if (!contract) continue;
    const list = byDate.get(contract.date) ?? [];
    list.push(contract.contract);
    byDate.set(contract.date, list);
  }

  const today = Date.now();
  const dated = [...byDate.keys()]
    .map((date) => ({ date, days: daysUntilExpiry(date, today) }))
    .filter((entry) => entry.days >= 1)
    .sort((a, b) => a.days - b.days);
  const keep = new Set<string>();
  for (const horizon of HORIZON_DAYS) {
    const latest = dated.filter((entry) => entry.days <= horizon).at(-1);
    if (latest) keep.add(latest.date);
  }
  const expiries: OptionExpiry[] = [...keep]
    .sort()
    .map((date) => ({ date, contracts: (byDate.get(date) ?? []).sort((a, b) => a.strike - b.strike) }));
  return expiries.length > 0 ? { symbol, price, ask, asOf, expiries } : null;
}

/** OCC symbol: root + YYMMDD + C/P + strike × 1000, zero-padded to 8 digits. */
const OCC_PATTERN = /^([A-Z]+)(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/;

function readContract(raw: unknown, symbol: string, spot: number): { date: string; contract: OptionContract } | null {
  if (!isRecord(raw) || typeof raw.option !== 'string') return null;
  const match = raw.option.match(OCC_PATTERN);
  // Only the standard root: SPYW-style weekly roots and adjusted contracts are skipped.
  if (!match || match[1] !== symbol) return null;
  const [, , yy, mm, dd, side, strikeDigits] = match;
  const strike = Number(strikeDigits) / 1000;
  const bid = numberOr(raw.bid);
  const ask = numberOr(raw.ask);
  const iv = numberOr(raw.iv);
  const openInterest = numberOr(raw.open_interest);
  const mid = (bid + ask) / 2;
  if (bid <= 0 || ask <= bid || iv <= 0 || openInterest < MIN_OPEN_INTEREST) return null;
  if ((ask - bid) / mid > MAX_RELATIVE_SPREAD) return null;
  if (strike < spot * 0.5 || strike > spot * 1.6) return null;
  // The builder only ever picks strikes between ~0.20 and ~0.50 delta.
  const absDelta = Math.abs(numberOr(raw.delta));
  if (absDelta < 0.08 || absDelta > 0.65) return null;
  return {
    date: `20${yy}-${mm}-${dd}`,
    contract: {
      type: side === 'C' ? 'call' : 'put',
      strike,
      bid,
      ask,
      iv,
      delta: numberOr(raw.delta),
      openInterest,
    },
  };
}

function numberOr(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
