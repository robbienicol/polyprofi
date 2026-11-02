import type { OptionChain } from '@/api/client/options-chain-types';
import {
  bearPutSpread,
  bullCallSpread,
  cashSecuredPut,
  collar,
  coveredCall,
  daysUntilExpiry,
  expiryForDeadline,
  ironCondor,
  longOption,
  type Candidate,
} from '@/lib/options-routes/positions';
import { toRoute } from '@/lib/options-routes/route-copy';
import { probabilityAboveAtExpiry } from '@/lib/volatility-probability';
import type { Route } from '@/types/routes';

/**
 * Options routes, built from live CBOE chains (see /api/options-chains) — eight
 * strategies on each liquid ticker, ranked through the same Pathey score as
 * everything else:
 *   - Price levels: call and put spreads ("closes above / below $X") and iron
 *     condors ("closes between $X and $Y") — a prediction market on any stock.
 *   - Directional: a bought call or put.
 *   - Shares: cash-secured puts, covered calls, and collars, which put a floor
 *     under the shares so a loss still returns most of the money.
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

/** Below this the route is noise, not a plan. */
const MIN_PROBABILITY = 1;

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
      bearPutSpread(chain, expiry),
      ironCondor(chain, expiry),
      cashSecuredPut(chain, expiry),
      coveredCall(chain, expiry),
      collar(chain, expiry),
    ];
    return positions.flatMap((candidate) => {
      if (!candidate) return [];
      const probability = winProbability(chain.price, candidate, years, riskFreePct);
      if (probability == null || probability < MIN_PROBABILITY) return [];
      return [toRoute(candidate.position, candidate.iv, probability, days, balance, target)];
    });
  });
}

function winProbability(spot: number, candidate: Candidate, years: number, riskFreePct: number): number | null {
  const { winLevel, winUpper, winDirection } = candidate.position;
  const above = probabilityAboveAtExpiry(spot, winLevel, candidate.iv, years, riskFreePct);
  if (above == null) return null;
  if (winDirection === 'between') {
    // Each edge is read off its own leg's IV, so skew is priced on both sides.
    const pastUpper = winUpper != null && candidate.upperIv != null
      ? probabilityAboveAtExpiry(spot, winUpper, candidate.upperIv, years, riskFreePct)
      : null;
    return pastUpper == null ? null : roundTenth(Math.max(0, above - pastUpper));
  }
  return roundTenth(winDirection === 'above' ? above : 100 - above);
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}
