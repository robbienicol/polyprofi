import { isLongHorizon } from '@/lib/quiz-profile';
import type { RouteParams } from '@/types/routes';

// The AI now generates ONLY Polymarket routes — the one category where it adds judgment
// (reading trader leads, validating against live prices, writing an exit plan). Stocks/ETFs
// and Savings/Treasuries are built deterministically downstream (buildEtfRoutes /
// buildTreasuryRoutes / playbookRoutes), so we no longer feed the model that data or ask it
// for those routes. That cuts both the input blocks and the output route count.
interface RoutePromptBlocks {
  picks: string;
  polymarket: string;
  popularPolymarket: string;
  metaculus: string;
  taggedPolymarket: string;
  metaculusEdges: string;
  whaleTrades: string;
}

interface RoutePromptInput {
  params: RouteParams;
  timeframeLabel: string;
  returnPct: number;
  blocks: RoutePromptBlocks;
}

export function buildRouteGenerationPrompt(input: RoutePromptInput): { system: string; user: string } {
  const { params, timeframeLabel, returnPct, blocks } = input;
  const { balance, target, timeframe, riskTolerance, maxRiskLevel, minProbability } = params;
  const horizonNote = isLongHorizon(timeframe)
    ? 'LONG TIMEFRAME: prefer contracts that resolve within the deadline; only include a Polymarket route if it clearly beats a safe baseline.'
    : 'SHORT TIMEFRAME: favor liquid contracts that resolve by the deadline, and give a clear exit strategy.';
  const riskNote = riskTolerance === 'conservative'
    ? 'CONSERVATIVE RISK: Polymarket prices must imply at least 80% probability; emphasize the safest liquid contracts.'
    : riskTolerance === 'aggressive'
      ? 'AGGRESSIVE RISK: include higher-payout contracts with a data-backed edge and state full downside.'
      : 'BALANCED RISK: mix mid-probability contracts with a few safer anchors.';

  const system = `You are a skeptical quant building PREDICTION-MARKET routes only.
Every route must trace to a live Polymarket Yes/No price, which is the market-implied probability.
Trader activity is only a lead — validate every idea against a live contract price.
Do NOT output stocks, ETFs, or treasuries; those are generated separately.`;

  const user = `USER GOAL: $${balance} → $${balance + target} (+$${target}) in ${timeframeLabel}
RETURN NEEDED: ${returnPct.toFixed(1)}%
RISK TOLERANCE: ${riskTolerance} (maximum risk ${maxRiskLevel}/5, minimum probability ${minProbability}%)
${horizonNote}
${riskNote}

POLYMARKET IDEAS (validate every idea against a live price)
${blocks.picks}

POLYMARKET ODDS
${blocks.polymarket}

POPULAR POLYMARKET CONTRACTS
${blocks.popularPolymarket}

METACULUS FORECASTS
${blocks.metaculus}

TAGGED POLYMARKET EVENTS
${blocks.taggedPolymarket}

METACULUS VS POLYMARKET EDGES
${blocks.metaculusEdges}

POLYMARKET WHALE TRADES
${blocks.whaleTrades}

RULES:
- Output ONLY routes in the "Polymarket" category. Stocks/ETFs/Treasuries are handled elsewhere — never include them.
- Every route needs a live line such as "Yes 62¢"; probability equals that price × 100. Include an entry and exit/sell plan.
- Assume the user invests the full $${balance}. Binary profit = stake × (1/price − 1).
- Set meetsTarget true only when expectedReturn is at least $${target}.
- maturesInDays is calendar days until the market resolves.
- Return 8–12 routes ranked safest to riskiest.

Return only a JSON array inside <routes> tags with this shape:
<routes>
[{"id":"1","category":"Polymarket","emoji":"🔮","description":"imperative action under 18 words","riskLevel":2,"probability":72,"expectedReturn":25,"lossProfile":"binary","meetsTarget":true,"platform":"Polymarket","line":"live Polymarket price e.g. Yes 62¢","maturesInDays":9,"strategy":"specific entry and exit plan"}]
</routes>`;

  return { system, user };
}
