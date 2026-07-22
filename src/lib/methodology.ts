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
    short: "Estimated from this fund's own recent price swings — not a forecast of direction.",
    long:
      'This probability is the chance the price moves at least your target amount within your ' +
      'timeframe, estimated from how much it has moved day-to-day over roughly the last 90 trading ' +
      'days. We assume no view on whether it goes up or down (zero drift) — the number reflects how ' +
      'much this thing wobbles, projected forward, and nothing about where we think it is headed.',
    caveats: [
      'Because it ignores the market’s long-run upward tendency, the odds shown for broad index funds are conservative — historically they have risen more often than a no-drift model implies.',
      'It assumes a normal spread of daily returns, so it understates rare crashes and sharp rallies (real markets have fatter tails).',
      'It is based on recent volatility, which is not a guarantee of future volatility.',
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
