/**
 * Converts a stock's recent volatility into P(price moves >= targetPct within horizonTradingDays),
 * assuming zero drift (no view on direction — purely "how much does this thing wobble").
 * Same probability unit as Polymarket's market price / sportsbook devig, so it can rank
 * alongside them.
 */

// Abramowitz & Stegun 7.1.26 approximation, max error 1.5e-7 — no erf in Math.
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const poly =
    t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return sign * (1 - poly * Math.exp(-a * a));
}

function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Daily stdev of log returns, using the most recent `window` daily closes (oldest→newest). */
export function dailyVolatility(closes: number[], window = 90): number | null {
  const recent = closes.slice(-window);
  if (recent.length < 10) return null;
  const returns = recent.slice(1).map((c, i) => Math.log(c / recent[i]));
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance);
}

/**
 * P(close return over horizonTradingDays >= targetPct), lognormal.
 * horizonTradingDays: ~5/week, ~21/month, ~63/3mo, ~252/year (matches market-data.ts's offsets).
 *
 * annualDriftPct is an assumed annual return (compounded, in log space). Default 0 = the
 * original zero-drift behavior ("how much does this wobble", no view on direction). Pass a
 * modest, DISCLOSED value for assets with a genuine long-run tendency (e.g. a broad index
 * fund) so their odds aren't understated. Keep it 0 for pure speculation.
 */
export function probabilityOfTargetMove(
  dailyVol: number | null,
  targetPct: number,
  horizonTradingDays: number,
  annualDriftPct = 0
): number | null {
  if (dailyVol == null || horizonTradingDays <= 0) return null;
  if (targetPct <= 0) return 100;
  if (dailyVol <= 0) return 0; // no volatility, can't make a positive move
  const sigmaT = dailyVol * Math.sqrt(horizonTradingDays);
  const driftT = Math.log(1 + annualDriftPct / 100) * (horizonTradingDays / 252);
  const z = (Math.log(1 + targetPct / 100) - driftT) / sigmaT;
  return Math.max(0, Math.min(100, (1 - normalCdf(z)) * 100));
}

// ── self-check ──────────────────────────────────────────────────────────────
export function __selfCheck(): void {
  console.assert(Math.abs(normalCdf(0) - 0.5) < 1e-6, 'CDF(0) = 0.5');
  console.assert(Math.abs(normalCdf(1.96) - 0.975) < 1e-3, 'CDF(1.96) ≈ 0.975');

  // flat price history → zero vol → can't hit any positive target, can always hit <=0%
  const flat = Array(30).fill(100);
  console.assert(dailyVolatility(flat) === 0, 'zero-variance closes → zero daily vol');
  console.assert(probabilityOfTargetMove(0, 10, 21) === 0, 'zero vol, positive target → 0%');
  console.assert(probabilityOfTargetMove(0, 0, 21) === 100, 'zero target always "hit"');

  // higher vol or longer horizon → higher probability of hitting the same target
  const lowVol = probabilityOfTargetMove(0.01, 10, 21)!;
  const highVol = probabilityOfTargetMove(0.03, 10, 21)!;
  console.assert(highVol > lowVol, 'more volatile name → higher P(hit) for same target');
  const shortHorizon = probabilityOfTargetMove(0.02, 10, 5)!;
  const longHorizon = probabilityOfTargetMove(0.02, 10, 63)!;
  console.assert(longHorizon > shortHorizon, 'more time → higher P(hit) for same target/vol');

  console.assert(probabilityOfTargetMove(null, 10, 21) === null, 'no vol data → null, not a fake number');

  // positive drift raises P(hit) for a positive target; default stays zero-drift
  const noDrift = probabilityOfTargetMove(0.01, 8, 252)!;
  const withDrift = probabilityOfTargetMove(0.01, 8, 252, 8)!;
  console.assert(withDrift > noDrift, 'assumed positive return raises P(hit)');
  console.assert(probabilityOfTargetMove(0.01, 8, 252, 0) === noDrift, 'drift defaults to 0 (unchanged)');
}
