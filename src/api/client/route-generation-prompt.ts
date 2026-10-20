import type { RawPick } from '@/types/picks';

/**
 * The prompt for the once-a-day AI prediction-market slate.
 *
 * It holds nothing about any one user. The model reads the day's Polymarket leads
 * and live prices and writes a broad slate of contracts, safe to risky, short to
 * long; each user's search then prices, filters and ranks that slate for their own
 * amount, deadline and risk on the device. That is what lets one generation a day
 * serve every search, where the old prompt carried the user's goal and so cost a
 * fresh GPT-4o call per search setting per phone.
 *
 * Only prediction markets: stocks, ETFs, savings and treasuries are built
 * deterministically from live quotes and never pass through the model.
 */
export interface SlatePromptBlocks {
  picks: string;
  polymarket: string;
  popularPolymarket: string;
  metaculus: string;
  taggedPolymarket: string;
  metaculusEdges: string;
  whaleTrades: string;
}

export function buildDailySlatePrompt(blocks: SlatePromptBlocks): { system: string; user: string } {
  const system = `You are a skeptical quant building PREDICTION-MARKET routes only.
Every route must trace to a live Polymarket Yes/No price, which is the market-implied probability.
Trader activity is only a lead — validate every idea against a live contract price.
Do NOT output stocks, ETFs, or treasuries; those are generated separately.
You are writing one shared slate for many users with different budgets, deadlines and risk
appetites, so never assume an amount of money or a goal.`;

  const user = `POLYMARKET IDEAS (validate every idea against a live price)
${blocks.picks}

POLYMARKET MARKET-IMPLIED PROBABILITIES
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
- Output ONLY routes in the "Polymarket" category.
- Every route needs a live line such as "Yes 62¢"; probability equals that price × 100. Include an entry and exit/sell plan.
- Cover the range, because users filter this slate by their own risk and deadline:
  roughly a third safe (probability 80%+), a third balanced (55–80%), a third riskier with a
  data-backed edge (under 55%); and a mix of contracts resolving within 2 weeks, within 3 months,
  and later.
- Never mention a dollar amount, stake or goal in any field.
- maturesInDays is calendar days until the market resolves.
- riskLevel is 1 (safest) to 5.
- Return 15–20 routes ranked safest to riskiest.
- The emoji field is a key, not decoration: use "🔮" and nothing else.

Return only a JSON array inside <routes> tags with this shape:
<routes>
[{"id":"1","category":"Polymarket","emoji":"🔮","description":"imperative action under 18 words","riskLevel":2,"probability":72,"lossProfile":"binary","platform":"Polymarket","line":"live Polymarket price e.g. Yes 62¢","maturesInDays":9,"strategy":"specific entry and exit plan"}]
</routes>`;

  return { system, user };
}

export function formatRawPicks(picks: RawPick[]): string {
  if (picks.length === 0) return 'No picks fetched; use market data only.';
  const qualityRank = { high: 0, medium: 1, low: 2 } as const;
  return [...picks]
    .sort((a, b) => qualityRank[a.sourceQuality] - qualityRank[b.sourceQuality])
    .slice(0, 40)
    .map((pick, index) => `[${index + 1}] (${pick.category}) ${pick.pick}\nReasoning: ${pick.reasoning}\nSource: ${pick.source} [${pick.sourceQuality}]`)
    .join('\n\n');
}

export function extractRoutesJson(text: string): string {
  return text.match(/<routes>([\s\S]*?)<\/routes>/)?.[1]?.trim()
    ?? text.match(/```json\n?([\s\S]*?)```/)?.[1]?.trim()
    ?? text.slice(Math.max(0, text.indexOf('[')), text.lastIndexOf(']') + 1);
}
