/**
 * Small display helpers shared by the portfolio screens, so Home, the Portfolio
 * tab and Positions write the same moment and the same percentage the same way.
 */

/** Digits drawn at one width, so figures do not jitter as they change. */
export const MONO = { fontVariant: ['tabular-nums' as const] };

/** The moment under the finger, as a person reads a timestamp. */
export function scrubLabel(time: number): string {
  const date = new Date(time);
  const clock = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return new Date().toDateString() === date.toDateString()
    ? clock
    : `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${clock}`;
}

/** A percentage with its sign spelled out: "+1.2" or "−0.4" (true minus, no "%"). */
export function signedPct(value: number, decimals: number): string {
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(decimals)}`;
}
