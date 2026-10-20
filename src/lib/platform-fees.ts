// First-pass approximation, not a precise fee calculator. Polymarket has no
// explicit per-trade fee in its standard flow — the real cost is the bid/ask
// spread, which callers should net out separately via bestBid/bestAsk when
// available rather than through this module. Kalshi charges a per-contract
// trading fee that scales with price*(1-price) (highest near 50c, tapering
// toward the extremes) per its published fee schedule; K below is a rough
// fit to that curve, not an exact figure, and should be rechecked against
// Kalshi's current fee docs before this comparison is presented as precise.
const KALSHI_FEE_CONSTANT = 0.07;

export function kalshiFeeEstimate(price: number, contracts: number): number {
  if (!Number.isFinite(price) || !Number.isFinite(contracts) || contracts <= 0) return 0;
  const clampedPrice = Math.max(0, Math.min(1, price));
  return Math.ceil(KALSHI_FEE_CONSTANT * clampedPrice * (1 - clampedPrice) * contracts * 100) / 100;
}

export function polymarketFeeEstimate(): number {
  return 0;
}

// Effective cost to acquire `contracts` at `rawPrice` on the given platform,
// expressed as a per-contract price (fees divided back across contracts) so
// it stays comparable to the platform's raw quoted price.
export function netYesPrice(rawPrice: number, platform: 'polymarket' | 'kalshi', contracts: number): number {
  const fee = platform === 'kalshi' ? kalshiFeeEstimate(rawPrice, contracts) : polymarketFeeEstimate();
  return rawPrice + fee / contracts;
}

export function __selfCheck(): void {
  console.assert(kalshiFeeEstimate(0, 100) === 0, 'no fee at price 0 — nothing at risk');
  console.assert(kalshiFeeEstimate(1, 100) === 0, 'no fee at price 1 — nothing at risk');
  console.assert(kalshiFeeEstimate(0.5, 100) > kalshiFeeEstimate(0.1, 100), 'fee should be highest near 50c');
  console.assert(polymarketFeeEstimate() === 0, 'no explicit Polymarket trading fee is modeled');
  console.assert(netYesPrice(0.5, 'kalshi', 100) > 0.5, 'Kalshi net price must include the estimated fee');
  console.assert(netYesPrice(0.5, 'polymarket', 100) === 0.5, 'Polymarket net price equals the raw price');
}
