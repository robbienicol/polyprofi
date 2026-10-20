import type { OptionLeg, OptionPosition, OptionStrategy, Route } from '@/types/routes';

interface StrategySpec {
  strategy: OptionStrategy;
  emoji: string;
  riskLevel: number;
  lossProfile: Route['lossProfile'];
}

const STRATEGIES: Record<OptionStrategy, StrategySpec> = {
  'long-call': { strategy: 'long-call', emoji: '🎯', riskLevel: 5, lossProfile: 'binary' },
  'long-put': { strategy: 'long-put', emoji: '🔻', riskLevel: 5, lossProfile: 'binary' },
  'bull-call-spread': { strategy: 'bull-call-spread', emoji: '📐', riskLevel: 4, lossProfile: 'binary' },
  'bear-put-spread': { strategy: 'bear-put-spread', emoji: '📉', riskLevel: 4, lossProfile: 'binary' },
  'iron-condor': { strategy: 'iron-condor', emoji: '↔️', riskLevel: 4, lossProfile: 'binary' },
  'cash-secured-put': { strategy: 'cash-secured-put', emoji: '💰', riskLevel: 3, lossProfile: 'partial' },
  'covered-call': { strategy: 'covered-call', emoji: '🛡️', riskLevel: 3, lossProfile: 'partial' },
  collar: { strategy: 'collar', emoji: '🪂', riskLevel: 2, lossProfile: 'partial' },
};

const STRATEGY_NAMES: Record<OptionStrategy, string> = {
  'long-call': 'Call',
  'long-put': 'Put',
  'bull-call-spread': 'Call spread',
  'bear-put-spread': 'Put spread',
  'iron-condor': 'Iron condor',
  'cash-secured-put': 'Cash-secured put',
  'covered-call': 'Covered call',
  collar: 'Collar',
};

/** Spreads and condors: a defined payout on a price level, read like a prediction-market contract. */
export function isLevelContract(strategy: OptionStrategy): boolean {
  return strategy === 'bull-call-spread' || strategy === 'bear-put-spread' || strategy === 'iron-condor';
}

/** The winning condition in a market board's words: "above $780", "$740–$800". */
export function winCondition(position: OptionPosition): string {
  if (position.winDirection === 'between') return `${money(position.winLevel)}–${money(position.winUpper ?? position.winLevel)}`;
  return `${position.winDirection} ${money(position.winLevel)}`;
}

export function toRoute(position: OptionPosition, iv: number, probability: number, days: number, balance: number, target: number): Route {
  const spec = STRATEGIES[position.strategy];
  const lots = Math.floor(balance / position.lotCost);
  const expectedReturn = Math.round(lots * position.lotCost * position.winReturnRate);
  const { underlying: ticker } = position;
  const date = formatExpiry(position.expiry);
  const spot = money(position.underlyingPrice);
  const lot = money(position.lotCost);
  const winPct = Math.round(position.winReturnRate * 1000) / 10;
  const finish = position.winDirection === 'between'
    ? `between ${money(position.winLevel)} and ${money(position.winUpper ?? position.winLevel)}`
    : `${position.winDirection} ${money(position.winLevel)}`;
  const line = isLevelContract(position.strategy)
    ? `${ticker} ${winCondition(position)} · ${date}`
    : `${ticker} ${STRATEGY_NAMES[position.strategy]} · ${date}`;

  return {
    id: `opt-${ticker.toLowerCase()}-${position.strategy}-${position.expiry}`,
    category: 'Options',
    emoji: spec.emoji,
    description: `${describeLegs(position)} — ${lot} per contract. Pays +${winPct}% if ${ticker} (now ${spot}) closes ${finish} on ${date}. The options market prices that at ~${probability.toFixed(0)}%.`,
    riskLevel: spec.riskLevel,
    probability,
    expectedReturn,
    platform: 'Options brokerage',
    strategy: strategyCopy(position),
    line,
    maturesInDays: days,
    lossProfile: spec.lossProfile,
    meetsTarget: expectedReturn >= target,
    optionPosition: { ...position, impliedVolatility: iv },
    investmentFacts: {
      projectionBasis: `Risk-neutral P(${ticker} ${finish} on ${date}) from the contracts' implied volatility (${(iv * 100).toFixed(0)}% at the win level); legs priced at the ask/bid, whole contracts only`,
      liquidity: 'Listed options — bought at the ask, sold at the bid, ~15-min delayed CBOE quotes',
      sourceCheckedAt: position.quotedAt,
    },
  };
}

function describeLegs(position: OptionPosition): string {
  const { underlying: ticker, legs } = position;
  const date = formatExpiry(position.expiry);
  const leg = (l: OptionLeg) => `${l.action === 'buy' ? 'buy' : 'sell'} the ${money(l.strike)} ${l.type}`;
  switch (position.strategy) {
    case 'long-call':
    case 'long-put':
      return `Buy 1 ${ticker} ${money(legs[0].strike)} ${legs[0].type} expiring ${date} at ${money(legs[0].price)}`;
    case 'bull-call-spread':
      return `${ticker} ${date} call spread: ${leg(legs[0])}, ${leg(legs[1])}`;
    case 'bear-put-spread':
      return `${ticker} ${date} put spread: ${leg(legs[0])}, ${leg(legs[1])}`;
    case 'iron-condor':
      return `${ticker} ${date} iron condor: sell the ${money(legs[1].strike)} put and ${money(legs[2].strike)} call, buy the ${money(legs[0].strike)} put and ${money(legs[3].strike)} call as wings`;
    case 'cash-secured-put':
      return `Sell 1 ${ticker} ${money(legs[0].strike)} put expiring ${date} for ${money(legs[0].price)}, cash set aside to buy the shares`;
    case 'covered-call':
      return `Buy 100 ${ticker} shares and sell the ${money(legs[1].strike)} call expiring ${date} for ${money(legs[1].price)}`;
    case 'collar':
      return `Buy 100 ${ticker} shares, buy the ${money(legs[1].strike)} put and sell the ${money(legs[2].strike)} call, both expiring ${date}`;
  }
}

function strategyCopy(position: OptionPosition): string {
  const { underlying: ticker } = position;
  const level = money(position.winLevel);
  const maxLoss = money(position.maxLoss);
  switch (position.strategy) {
    case 'long-call':
      return `A bet that ${ticker} rises past ${level} by expiry. Below the strike the contract expires worthless and you lose the full ${maxLoss} premium; between the strike and ${level} you get some of it back. Time decay works against you every day.`;
    case 'long-put':
      return `A bet that ${ticker} falls below ${level} by expiry. Above the strike the contract expires worthless and you lose the full ${maxLoss} premium. Time decay works against you every day.`;
    case 'bull-call-spread':
      return `A capped bet that ${ticker} rises: selling the higher call pays for part of the lower one. Above ${level} you collect the full spread; below the lower strike you lose the ${maxLoss} paid. Cheaper than a plain call, with less upside.`;
    case 'bear-put-spread':
      return `A capped bet that ${ticker} falls: selling the lower put pays for part of the higher one. Below ${level} you collect the full spread; above the higher strike you lose the ${maxLoss} paid. Cheaper than a plain put, with less upside.`;
    case 'iron-condor': {
      const upper = money(position.winUpper ?? position.winLevel);
      return `A bet that ${ticker} stays in a range. You're paid now on the promise it finishes between ${level} and ${upper}; anywhere inside, you keep it all. Past either edge the loss grows until the bought wings cap it at ${maxLoss} per contract. It doesn't need ${ticker} to move — it needs it not to.`;
    }
    case 'cash-secured-put':
      return `You're paid now to agree to buy 100 ${ticker} shares at ${level}. If ${ticker} stays above it, you keep the premium and the cash. If it drops below, you buy the shares at ${level} — you still own them, but at a loss on paper until they recover.`;
    case 'covered-call':
      return `You own 100 ${ticker} shares and sell someone the right to buy them at ${level}. The premium cushions a small drop; above ${level} your shares are called away at that price, so the gain is capped. Below it you keep the shares and whatever they're worth.`;
    case 'collar': {
      const floor = money(position.legs[1].strike);
      return `You own 100 ${ticker} shares with a floor: the put lets you sell them at ${floor} however far ${ticker} falls, and selling the ${level} call helps pay for it. The most you can lose is ${maxLoss} per contract; above ${level} the shares are called away, so the gain is capped. A loss still hands back most of the money.`;
    }
  }
}

function money(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: value < 1000 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

function formatExpiry(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
