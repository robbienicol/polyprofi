import type { OptionChain, OptionContract } from '@/api/client/options-chain-types';
import { buildOptionsRoutes } from '@/lib/options-routes/build';

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
          contract('put', 95, 1.1, 1.2, -0.25),
          contract('put', 92, 0.6, 0.7, -0.18),
        ],
      },
      { date: '2027-01-15', contracts: [contract('call', 110, 2, 2.1, 0.3)] },
    ],
  };
  const routes = buildOptionsRoutes({ chains: [chain], balance: 20_000, target: 500, deadlineDays: 30, riskFreePct: 4, now });

  console.assert(routes.length === 5, 'all five strategies built from one liquid expiry');
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
}
