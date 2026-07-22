/**
 * How PolyProfit calculates the "probability" shown on each route — the honest,
 * per-method disclosure. Three route types compute probability three different ways,
 * so they get three different explanations. Do NOT collapse these into one global
 * footer: the whole trust wedge depends on not passing off a model estimate as a
 * market-implied truth (and vice-versa).
 *
 * `short` = one line for the route card / next to the meter.
 * `long`  = the "How we calculate this" detail screen.
 */

import { isDebtRoute } from '@/lib/route-investment-metrics';
import type { Route } from '@/types/routes';

export type ProbabilityMethod = 'volatility' | 'market-implied' | 'contractual-yield';

const MARKET_IMPLIED_PATTERN = /polymarket|prediction|sportsbook|parlay|moneyline|\bml\b|over\/under|spread/i;

/** Which of the three probability methods produced this route's number. Drives the detail-screen disclosure. */
export function probabilityMethodForRoute(route: Route): ProbabilityMethod {
  if (isDebtRoute(route)) return 'contractual-yield';
  const text = [route.category, route.platform, route.line].filter(Boolean).join(' ');
  if (MARKET_IMPLIED_PATTERN.test(text) || (route.lossProfile === 'binary' && route.line != null)) {
    return 'market-implied';
  }
  return 'volatility';
}

export interface MethodologyCopy {
  method: ProbabilityMethod;
  /** Small label shown under the probability meter, e.g. "Volatility estimate". */
  badge: string;
  /** One line, card-level. */
  short: string;
  /** Full explanation for the detail screen, plus the honest caveats. */
  long: string;
  /** The specific limitations a skeptic (or regulator) would want stated. */
  caveats: string[];
}

export const METHODOLOGY: Record<ProbabilityMethod, MethodologyCopy> = {
  // Stocks, ETFs, crypto — anything priced from its own historical volatility.
  volatility: {
    method: 'volatility',
    badge: 'Volatility estimate',
    short: "Estimated from this fund's recent price swings plus a modest, capped assumed return.",
    long:
      'This probability is the chance the price moves at least your target amount within your ' +
      'timeframe. It combines how much the fund has moved day-to-day over roughly the last 90 ' +
      'trading days with a modest assumed return equal to the fund’s own long-run (5-year) trend — ' +
      'capped at 8% per year so we credit its upward tendency without assuming it repeats a recent ' +
      'boom. It is an estimate of the odds, not a forecast of what will happen.',
    caveats: [
      'The assumed return is capped at 8%/yr — we credit a fund’s long-run tendency but never project a hot streak forward. A fund whose own trend is lower (e.g. bonds) is credited less.',
      'It assumes a normal spread of daily returns, so it understates rare crashes and sharp rallies (real markets have fatter tails).',
      'It is based on recent volatility and past trend, neither of which is a guarantee of the future.',
      'You keep your capital minus any price decline — this is not a bet you lose entirely.',
    ],
  },

  // Polymarket, sportsbook lines — a live market consensus, de-vigged.
  'market-implied': {
    method: 'market-implied',
    badge: 'Market consensus',
    short: "The market's own consensus price, with the house margin stripped out.",
    long:
      'This probability comes from live market prices, not from us. We strip out the bookmaker or ' +
      'exchange margin (the "vig") so the number reflects the true implied probability that real ' +
      'money currently assigns to the outcome. It updates continuously as the market moves.',
    caveats: [
      'It reflects the current crowd consensus, which can be wrong and can swing quickly.',
      'A binary market pays out or it does not — if the outcome misses, you lose the entire stake.',
      'Thinly-traded markets can have unreliable prices even after de-vigging.',
    ],
  },

  // T-bills, HYSA, CDs held to maturity — a contractual rate, not an estimate.
  'contractual-yield': {
    method: 'contractual-yield',
    badge: 'Contractual yield',
    short: 'A stated yield, not an estimate — the return is known if held to maturity.',
    long:
      'This is not a statistical estimate. The yield is contractual: held to maturity, the return is ' +
      'known in advance. The very high probability shown reflects only issuer and settlement risk, ' +
      'not market movement.',
    caveats: [
      'Selling before maturity exposes you to price movement; the stated return assumes you hold to maturity.',
      'Returns are shown pre-tax; compare after-tax yield for your situation.',
    ],
  },
};

/**
 * Global, always-visible framing. PolyProfit surfaces information and statistical
 * estimates — it does not tell any individual what to buy. This is the honesty
 * positioning AND the regulatory posture (see PITCH_INTERNAL §13.5). Keep it verbatim
 * until a securities lawyer signs off on different language.
 */
export const PROBABILITY_DISCLAIMER =
  'PolyProfit shows information and statistical estimates to help you compare options. It is not ' +
  'personalized investment advice and not a recommendation to buy or sell any security. Probabilities ' +
  'are estimates, not guarantees. You are responsible for your own decisions.';

// ── self-check ──────────────────────────────────────────────────────────────
export function __selfCheck(): void {
  const base = {
    id: 'x', category: '', emoji: '', description: '', riskLevel: 3, probability: 50,
    expectedReturn: 100, platform: '', strategy: '', lossProfile: 'partial' as const, meetsTarget: true,
  };

  console.assert(
    probabilityMethodForRoute({ ...base, category: 'Savings & Treasuries', platform: 'TreasuryDirect' }) === 'contractual-yield',
    'treasury/HYSA → contractual-yield',
  );
  console.assert(
    probabilityMethodForRoute({ ...base, category: 'Stocks & ETFs', platform: 'Brokerage' }) === 'volatility',
    'ETF/stock → volatility',
  );
  console.assert(
    probabilityMethodForRoute({ ...base, category: 'Polymarket', platform: 'Polymarket', lossProfile: 'binary' }) === 'market-implied',
    'Polymarket → market-implied',
  );
  console.assert(
    probabilityMethodForRoute({ ...base, category: 'Sports', platform: 'Sportsbook', lossProfile: 'binary', line: 'France ML -200' }) === 'market-implied',
    'sportsbook line → market-implied',
  );

  // every method has copy with the pieces the detail screen renders
  for (const key of ['volatility', 'market-implied', 'contractual-yield'] as const) {
    const copy = METHODOLOGY[key];
    console.assert(!!copy.badge && !!copy.short && !!copy.long && copy.caveats.length > 0, `${key} copy is complete`);
  }
}
