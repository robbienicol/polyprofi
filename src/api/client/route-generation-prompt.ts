import { formatPlaybook, getPlaybook } from '@/api/client/playbook';
import { isLongHorizon } from '@/lib/quiz-profile';
import type { RouteParams } from '@/types/routes';

interface RoutePromptBlocks {
  picks: string;
  polymarket: string;
  popularPolymarket: string;
  metaculus: string;
  taggedPolymarket: string;
  metaculusEdges: string;
  whaleTrades: string;
  stocks: string;
  treasury: string;
}

interface RoutePromptInput {
  params: RouteParams;
  timeframeLabel: string;
  returnPct: number;
  horizonTradingDays: number;
  annualizedReturn: number | null;
  blocks: RoutePromptBlocks;
}

export function buildRouteGenerationPrompt(input: RoutePromptInput): { system: string; user: string } {
  const { params, timeframeLabel, returnPct, horizonTradingDays, annualizedReturn, blocks } = input;
  const { balance, target, timeframe, riskTolerance, maxRiskLevel, minProbability } = params;
  const conservativeGoal = annualizedReturn !== null && annualizedReturn <= 10;
  const conservativeNote = conservativeGoal
    ? `CONSERVATIVE GOAL: ${annualizedReturn.toFixed(1)}% annualized. Lead with T-bills, HYSA, short-term bonds, then broad index funds. No long shots.`
    : '';
  const horizonNote = isLongHorizon(timeframe)
    ? `LONG TIMEFRAME: Lead with ETFs, T-bills, HYSA, and bonds. Put Polymarket lower unless it clearly beats the safe baseline.`
    : `SHORT TIMEFRAME: Index funds are not viable for this deadline. Lead with liquid Polymarket contracts and include an exit strategy.`;
  const riskNote = riskTolerance === 'conservative'
    ? 'CONSERVATIVE RISK: Polymarket prices must imply at least 80% probability; emphasize capital-preserving routes.'
    : riskTolerance === 'aggressive'
      ? 'AGGRESSIVE RISK: Include higher-payout Polymarket contracts with a data-backed edge and state full downside.'
      : 'BALANCED RISK: Mix mid-probability Polymarket contracts with broad ETFs and safe anchors.';
  const playbook = formatPlaybook(getPlaybook(returnPct, timeframe), returnPct, timeframeLabel);

  const system = `You are a skeptical quant. Build money routes from hard data only:
1. Polymarket live Yes/No prices, which are the market-implied probabilities.
2. Stocks, ETFs, and Treasuries using historical returns, realized volatility, and sourced yields.

Trader activity is only a lead. Every route must trace to a live contract price or a supplied statistical figure. Lead with capital-preserving routes.`;

  const user = `USER GOAL: $${balance} → $${balance + target} (+$${target}) in ${timeframeLabel}
RETURN NEEDED: ${returnPct.toFixed(1)}%
RISK TOLERANCE: ${riskTolerance} (maximum risk ${maxRiskLevel}/5, minimum probability ${minProbability}%)
UNIVERSE: Polymarket, Stocks/ETFs, and Savings/Treasuries only. No sports, crypto, or forex.
${conservativeNote}
${horizonNote}
${riskNote}

CALIBRATED BASELINE (always include)
${playbook}

POLYMARKET IDEAS (validate every idea against a live price)
${blocks.picks}

STOCKS, ETFs, AND TREASURY YIELDS
${blocks.stocks}

OFFICIAL TREASURY BILL CURVE
${blocks.treasury}

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
- Output only these categories: "Polymarket", "Stocks & ETFs", "Savings & Treasuries".
- Polymarket routes require a live line such as "Yes 62¢"; probability equals that price × 100. Include an exit/sell strategy.
- Stock/ETF probability must use the supplied P(+target% within horizon) figure.
- Treasury routes must use supplied yields and maturities that finish by the deadline.
- Assume the user invests the full $${balance}. Binary profit = stake × (1/price − 1). Treasury profit uses annual yield prorated over maturity.
- Set meetsTarget true only when expectedReturn is at least $${target}.
- maturesInDays is calendar days until resolution or payout. For stocks use about ${horizonTradingDays} trading days.
- Return 20–30 routes ranked safest to riskiest.

Return only a JSON array inside <routes> tags with this shape:
<routes>
[{"id":"1","category":"Polymarket | Stocks & ETFs | Savings & Treasuries","emoji":"📈","description":"imperative action under 18 words","riskLevel":1,"probability":72,"expectedReturn":25,"lossProfile":"binary or partial","meetsTarget":true,"platform":"specific platform","line":"live Polymarket price or omit","maturesInDays":9,"strategy":"specific entry and exit plan"}]
</routes>`;

  return { system, user };
}
