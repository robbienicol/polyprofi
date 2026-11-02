import type { OptionChain, OptionContract } from '@/api/client/options-chain-types';
import { buildOptionsRoutes } from '@/lib/options-routes/build';
import { payoffAtExpiry } from '@/lib/options-routes/positions';

// ── self-check ──────────────────────────────────────────────────────────────
export function __selfCheck(): void {
  const now = Date.parse('2026-09-30T15:00:00Z');
  const contract = (type: 'call' | 'put', strike: number, bid: number, ask: number, delta: number): OptionContract => ({
    type, strike, bid, ask, iv: 0.3, delta, openInterest: 1000,
  });
  const chain: OptionChain = {
    symbol: 'TEST',
    price: 100,
    ask: 100.05,
    asOf: '2026-09-30 15:00:00',
    expiries: [
      {
        date: '2026-10-23',
        contracts: [
          contract('call', 100, 3.4, 3.5, 0.52),
          contract('call', 105, 1.6, 1.7, 0.3),
          contract('call', 108, 0.9, 1.0, 0.22),
          contract('call', 112, 0.35, 0.4, 0.1),
          contract('put', 95, 1.1, 1.2, -0.25),
          contract('put', 92, 0.6, 0.7, -0.18),
          contract('put', 88, 0.25, 0.3, -0.1),
        ],
      },
      { date: '2027-01-15', contracts: [contract('call', 110, 2, 2.1, 0.3)] },
    ],
  };
  const routes = buildOptionsRoutes({ chains: [chain], balance: 20_000, target: 500, deadlineDays: 30, riskFreePct: 4, now });

  console.assert(routes.length === 8, 'all eight strategies built from one liquid expiry');
  console.assert(routes.every((r) => r.optionPosition?.expiry === '2026-10-23'), 'uses the last expiry inside the deadline, never a later one');
  console.assert(buildOptionsRoutes({ chains: [chain], balance: 20_000, target: 500, deadlineDays: 7, riskFreePct: 4, now }).length === 0, 'no expiry inside the deadline → no routes');

  const call = routes.find((r) => r.optionPosition?.strategy === 'long-call')!;
  console.assert(call.optionPosition!.legs[0].strike === 105 && call.optionPosition!.legs[0].price === 1.7, 'the long call is bought at the ask, at ~0.30 delta');
  console.assert(call.optionPosition!.lotCost === 170, 'one contract is 100 shares');
  console.assert(Math.abs(call.optionPosition!.winLevel - 108.4) < 1e-9, 'win level is strike + 2× premium');

  const spread = routes.find((r) => r.optionPosition?.strategy === 'bull-call-spread')!;
  const debit = 3.5 - 0.9;
  console.assert(Math.abs(spread.optionPosition!.lotCost - debit * 100) < 1e-9, 'spread debit is long ask minus short bid');
  console.assert(Math.abs(spread.optionPosition!.winReturnRate - (8 - debit) / debit) < 1e-9, 'spread max profit is width minus debit');

  const csp = routes.find((r) => r.optionPosition?.strategy === 'cash-secured-put')!;
  console.assert(csp.optionPosition!.legs[0].strike === 92 && csp.optionPosition!.lotCost === 9200, 'CSP ties up the full strike, at ~0.20 delta');
  console.assert(csp.lossProfile === 'partial' && call.lossProfile === 'binary', 'selling premium keeps the shares; a bought option can expire worthless');

  const cc = routes.find((r) => r.optionPosition?.strategy === 'covered-call')!;
  console.assert(Math.abs(cc.optionPosition!.lotCost - (100.05 - 0.9) * 100) < 1e-9, 'covered call pays the share ask, less the call bid');

  const put = routes.find((r) => r.optionPosition?.strategy === 'long-put')!;
  console.assert(put.optionPosition!.winDirection === 'below' && Math.abs(put.optionPosition!.winLevel - 92.6) < 1e-9, 'a put wins below strike − 2× premium');
  console.assert(csp.probability > call.probability, 'selling an OTM put is likelier to pay than buying an OTM call');

  const bear = routes.find((r) => r.optionPosition?.strategy === 'bear-put-spread')!;
  console.assert(Math.abs(bear.optionPosition!.lotCost - (1.2 - 0.6) * 100) < 1e-9, 'put spread debit is long ask minus short bid');
  console.assert(bear.optionPosition!.winDirection === 'below' && bear.optionPosition!.winLevel === 92, 'a put spread pays in full below the sold strike');
  console.assert(bear.line === 'TEST below $92.00 · Oct 23' && spread.line === 'TEST above $108.00 · Oct 23', 'spreads read like a price-level contract');

  const condor = routes.find((r) => r.optionPosition?.strategy === 'iron-condor')!;
  const credit = 0.6 + 0.9 - 0.3 - 0.4;
  console.assert(Math.abs(condor.optionPosition!.lotCost - (4 - credit) * 100) < 1e-9, 'the condor stakes the wider wing less the credit');
  console.assert(Math.abs(condor.optionPosition!.winReturnRate - credit / (4 - credit)) < 1e-9, 'the condor wins its credit on what it stakes');
  console.assert(condor.optionPosition!.winDirection === 'between' && condor.optionPosition!.winLevel === 92 && condor.optionPosition!.winUpper === 108, 'the condor wins between its sold strikes');
  console.assert(condor.probability > 0 && condor.probability < csp.probability, 'staying inside a range is less likely than staying above its floor');
  console.assert(condor.line === 'TEST $92.00–$108.00 · Oct 23', 'a condor reads as a range');

  const floored = routes.find((r) => r.optionPosition?.strategy === 'collar')!;
  const netCost = 100.05 + 1.2 - 0.9;
  console.assert(Math.abs(floored.optionPosition!.maxLoss - (netCost - 95) * 100) < 1e-6, 'a collar can lose only down to its put');
  console.assert(Math.abs(payoffAtExpiry(floored.optionPosition!, 0) + floored.optionPosition!.maxLoss) < 1e-6, 'even at zero the collar loses no more than its floor');
  console.assert(Math.abs(payoffAtExpiry(floored.optionPosition!, 200) - (108 - netCost) * 100) < 1e-6, 'above the call the collar is capped');
  console.assert(floored.lossProfile === 'partial' && floored.optionPosition!.impliedVolatility === 0.3, 'a collar keeps the shares and records its IV');
  console.assert(Math.abs(payoffAtExpiry(csp.optionPosition!, 100) - 60) < 1e-9, 'a put that expires worthless keeps its premium');
}
