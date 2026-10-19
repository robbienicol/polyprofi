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
  'cash-secured-put': { strategy: 'cash-secured-put', emoji: '💰', riskLevel: 3, lossProfile: 'partial' },
  'covered-call': { strategy: 'covered-call', emoji: '🛡️', riskLevel: 3, lossProfile: 'partial' },
};

const STRATEGY_NAMES: Record<OptionStrategy, string> = {
  'long-call': 'Call',
  'long-put': 'Put',
  'bull-call-spread': 'Call spread',
  'cash-secured-put': 'Cash-secured put',
  'covered-call': 'Covered call',
};

export function toRoute(position: OptionPosition, iv: number, probability: number, days: number, balance: number, target: number): Route {
  const spec = STRATEGIES[position.strategy];
  const lots = Math.floor(balance / position.lotCost);
  const expectedReturn = Math.round(lots * position.lotCost * position.winReturnRate);
  const { underlying: ticker } = position;
  const date = formatExpiry(position.expiry);
  const level = money(position.winLevel);
  const spot = money(position.underlyingPrice);
  const lot = money(position.lotCost);
  const winPct = Math.round(position.winReturnRate * 1000) / 10;
  const direction = position.winDirection === 'above' ? 'above' : 'below';

  return {
    id: `opt-${ticker.toLowerCase()}-${position.strategy}-${position.expiry}`,
    category: 'Options',
    emoji: spec.emoji,
    description: `${describeLegs(position)} — ${lot} per contract. Pays +${winPct}% if ${ticker} (now ${spot}) closes ${direction} ${level} on ${date}. The options market prices that at ~${probability.toFixed(0)}%.`,
    riskLevel: spec.riskLevel,
    probability,
    expectedReturn,
    platform: 'Options brokerage',
    strategy: strategyCopy(position),
    line: `${ticker} ${STRATEGY_NAMES[position.strategy]} · ${date}`,
    maturesInDays: days,
    lossProfile: spec.lossProfile,
    meetsTarget: expectedReturn >= target,
    optionPosition: position,
    investmentFacts: {
      projectionBasis: `Risk-neutral P(${ticker} ${direction} ${level} on ${date}) from the contract's ${(iv * 100).toFixed(0)}% implied volatility; legs priced at the ask/bid, whole contracts only`,
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
    case 'cash-secured-put':
      return `Sell 1 ${ticker} ${money(legs[0].strike)} put expiring ${date} for ${money(legs[0].price)}, cash set aside to buy the shares`;
    case 'covered-call':
      return `Buy 100 ${ticker} shares and sell the ${money(legs[1].strike)} call expiring ${date} for ${money(legs[1].price)}`;
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
    case 'cash-secured-put':
      return `You're paid now to agree to buy 100 ${ticker} shares at ${level}. If ${ticker} stays above it, you keep the premium and the cash. If it drops below, you buy the shares at ${level} — you still own them, but at a loss on paper until they recover.`;
    case 'covered-call':
      return `You own 100 ${ticker} shares and sell someone the right to buy them at ${level}. The premium cushions a small drop; above ${level} your shares are called away at that price, so the gain is capped. Below it you keep the shares and whatever they're worth.`;
  }
}

function money(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: value < 1000 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

function formatExpiry(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
