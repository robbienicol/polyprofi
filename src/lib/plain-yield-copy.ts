import type { Route } from '@/types/routes';

/**
 * The one-line description on a savings or Treasury route, written so someone who
 * has never bought one knows exactly what they are about to buy, for how much, and
 * what comes back. "Put your $5,000 in 13-week T-bill — 4.20% 13-week T-bill
 * coupon-equivalent yield projects +$52 over 3mo" answered none of that plainly.
 * Yield sources, conventions and liquidity terms belong on the detail screen.
 */

export type YieldInstrument = 'tbill' | 'hysa' | 'treasury-fund' | 'other';

const TREASURY_FUNDS = /\b(SGOV|BIL|SHV|USFR|TFLO|VBIL|BILS)\b/;

export function yieldInstrument(route: Pick<Route, 'id' | 'description'> & { investmentFacts?: Route['investmentFacts'] }): YieldInstrument {
  const text = `${route.description} ${route.investmentFacts?.yieldLabel ?? ''}`;
  if (route.id === 'savings-account-hysa' || /savings account|\bhysa\b/i.test(route.description)) return 'hysa';
  if (TREASURY_FUNDS.test(route.description)) return 'treasury-fund';
  if (route.id.startsWith('treasury-') || /t-?bill|treasury bill|\^IRX/i.test(text)) return 'tbill';
  return 'other';
}

/** A bill's term the way people say it: "3-month", not "13w". */
export function termWords(days: number): { adjective: string; phrase: string } {
  const months = Math.round(days / 30.4);
  // The 6- and 8-week bills are sold under those names, and rounding 42 days to
  // "1-month" put a month on the card beside a six-week maturity badge.
  if (days < 21 || (days >= 35 && days < 60)) {
    const weeks = Math.max(1, Math.round(days / 7));
    return { adjective: `${weeks}-week`, phrase: weeks === 1 ? '1 week' : `${weeks} weeks` };
  }
  if (months >= 12 && months % 12 === 0) {
    const years = months / 12;
    return { adjective: `${years}-year`, phrase: years === 1 ? '1 year' : `${years} years` };
  }
  return { adjective: `${months}-month`, phrase: months === 1 ? '1 month' : `${months} months` };
}

function dollars(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function percent(value: number): string {
  return `${Number(value.toFixed(value >= 10 ? 1 : 2)).toString()}%`;
}

export function plainYieldDescription({
  instrument,
  stake,
  profit,
  days,
  yieldPct,
  name,
}: {
  instrument: YieldInstrument;
  stake: number;
  profit: number;
  days: number | null;
  yieldPct: number;
  /** The fund's ticker, or whatever the instrument is called, for the non-bill cases. */
  name?: string;
}): string {
  switch (instrument) {
    case 'tbill': {
      const term = termWords(days ?? 91);
      return `Buy a ${term.adjective} U.S. Treasury bill for ${dollars(stake)}. You get ${dollars(stake + profit)} back in ${term.phrase}.`;
    }
    case 'hysa':
      return `Put ${dollars(stake)} in a high-yield savings account earning about ${percent(yieldPct)} a year. Take it out anytime.`;
    case 'treasury-fund':
      return `Buy ${dollars(stake)} of ${name ?? 'a Treasury bill fund'}, a fund that holds short-term U.S. Treasury bills. It earns about ${percent(yieldPct)} a year, and you can sell anytime.`;
    case 'other':
      return `Put ${dollars(stake)} in ${name ?? 'this'}, earning about ${percent(yieldPct)} a year.`;
  }
}

/** Plain copy for a route that already carries a sourced yield, at the given stake. */
export function describeYieldRoute(route: Route, stake: number, profit: number, days: number | null): string | null {
  const yieldPct = route.investmentFacts?.yieldPct;
  if (yieldPct == null) return null;
  const instrument = yieldInstrument(route);
  const fund = route.description.match(TREASURY_FUNDS)?.[1];
  const other = route.description
    .split('—')[0]
    ?.replace(/^(buy a|buy|put|park|place|move)\s+(your\s+)?(\$[\d,]+\s+)?(of\s+)?(in|into|on)?\s*/i, '')
    .replace(/[.,]\s*$/, '')
    .trim();
  return plainYieldDescription({
    instrument,
    stake,
    profit,
    days,
    yieldPct,
    name: instrument === 'treasury-fund' ? fund : other || undefined,
  });
}

export function __selfCheck(): void {
  const check = (condition: boolean, message: string) => {
    if (!condition) throw new Error(`[plain-yield-copy] ${message}`);
  };
  check(
    plainYieldDescription({ instrument: 'tbill', stake: 5_000, profit: 52, days: 91, yieldPct: 4.2 })
      === 'Buy a 3-month U.S. Treasury bill for $5,000. You get $5,052 back in 3 months.',
    'a bill says what it is, what it costs, what comes back and when',
  );
  check(termWords(28).adjective === '1-month' && termWords(42).adjective === '6-week' && termWords(182).adjective === '6-month' && termWords(364).adjective === '1-year',
    'bill terms read in months, not weeks');
  check(
    plainYieldDescription({ instrument: 'hysa', stake: 1_000, profit: 10, days: null, yieldPct: 4.1 })
      === 'Put $1,000 in a high-yield savings account earning about 4.1% a year. Take it out anytime.',
    'a savings account says the rate and that the money stays yours to withdraw',
  );
  const route = {
    id: 'x', category: 'Savings & Treasuries', emoji: '', riskLevel: 1, probability: 99, expectedReturn: 10,
    platform: '', strategy: '', lossProfile: 'partial' as const, meetsTarget: false,
    description: 'Put your $1,000 in SGOV — 4.30% 30-day SEC yield projects +$10 over 3mo.',
    investmentFacts: { yieldPct: 4.3 },
  };
  check(describeYieldRoute(route, 2_000, 21, 91)?.startsWith('Buy $2,000 of SGOV, a fund that holds short-term U.S. Treasury bills') === true,
    'a Treasury fund is named and explained in one clause');
}
