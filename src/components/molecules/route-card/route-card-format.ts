import { routeFeed } from '@/api/hooks/useRouteLive';
import { CategoryScale, Colors, RiskScale } from '@/constants/theme';
import type { GoalOdds } from '@/lib/goal-odds';
import type { Route } from '@/types/routes';

const RISK_LABELS = ['Very safe', 'Safe', 'Moderate', 'Aggressive', 'Very aggressive'] as const;

export const riskLabel = (level: number) => RISK_LABELS[level - 1] ?? 'Unknown';
export const riskColor = (level: number) => RiskScale[level - 1] ?? Colors.light.textSecondary;

/**
 * How long until the money comes back, coded by speed rather than by good or bad:
 * a quick route is not a better one, it just frees the money sooner. Category hues,
 * not semantic ones, for the same reason.
 */
export function maturityColor(days: number): string {
  if (days <= 30) return CategoryScale.slate;
  if (days <= 180) return CategoryScale.haze;
  return CategoryScale.stone;
}

export function shortMaturity(days: number): string {
  if (days < 14) return `${Math.max(1, Math.round(days))}d`;
  if (days < 60) return `${Math.round(days / 7)} wk`;
  if (days < 365) return `${Math.round(days / 30)} mo`;
  return `${Number((days / 365).toFixed(1))} yr`;
}

/**
 * The risk band to *show*, which can never read safer than the odds. A route's own
 * riskLevel comes from its instrument, so a 50/50 trade on a 96¢ contract carried the
 * contract's "Safe". Here the chance of it working and whether it can go to zero both
 * set a floor: all-or-nothing is at least Moderate, under 60% at least Aggressive.
 */
export function displayRiskLevel(route: Pick<Route, 'riskLevel' | 'probability' | 'lossProfile' | 'noCapitalRequired' | 'category'>): number {
  if (route.noCapitalRequired || route.category === 'Savings & Treasuries') return route.riskLevel;
  let level = route.riskLevel;
  if (route.lossProfile === 'binary') level = Math.max(level, 3);
  if (route.probability < 80) level = Math.max(level, 3);
  if (route.probability < 60) level = Math.max(level, 4);
  if (route.probability < 35) level = 5;
  return Math.min(5, Math.max(1, level));
}

/** Probability as a whole percent — the score behind it is a float (e.g. a
 * volatility model's raw output), and nobody reads "68.89310056155591%" as
 * a number rather than a bug. */
export const formatProbability = (value: number) => `${Math.round(value)}%`;

/** The chance, coded the way a quote board codes it: likely green, coin-flip amber, long shot red. */
export type ChanceTone = 'positive' | 'caution' | 'negative';
export function chanceTone(percent: number): ChanceTone {
  if (percent >= 60) return 'positive';
  if (percent >= 30) return 'caution';
  return 'negative';
}

/** Compact maturity label: 1d, 9d, 3w, 5mo, 1.5y. */
export function formatMaturity(days: number): string {
  if (days <= 1) return '1d';
  if (days < 14) return `${Math.round(days)}d`;
  if (days < 60) return `${Math.round(days / 7)}w`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  const y = days / 365;
  return `${y % 1 === 0 ? y : y.toFixed(1)}y`;
}

export function formatMoney(amount: number): string {
  return amount.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/**
 * Every prediction-market route is sourced from Polymarket, but that's an
 * implementation detail now that the detail page can show a cheaper Kalshi
 * price for a matched market (sports and, since the generic matcher, a good
 * slice of politics/economics/crypto/culture too) — see market-comparison.ts.
 * The card leads with what it actually is; which venue to buy it on is a
 * decision the detail page makes, not a label on the list.
 */
export function displayLabel(value: string): string {
  return value === 'Polymarket' ? 'Prediction market' : value;
}

/** What "bad case" means for this route, in words a first-timer reads once. */
function badCaseNote(odds: GoalOdds): string {
  switch (odds.badCaseKind) {
    case 'all': return 'all of it';
    case 'stop': return 'at the stop';
    case 'tail': return '1-in-20 bad stretch';
    case 'none': return 'nothing at risk';
  }
}

/** When the money comes back, in plain words: "Pays out in 3 mo", "Hold 2 wk". */
export function maturityWords(route: Route): string {
  const span = shortMaturity(route.maturesInDays ?? 0);
  if (route.sourceSlug || route.optionPosition) return `Pays out in ${span}`;
  if (/savings|treasur/i.test(route.category)) return `Matures in ${span}`;
  return `Hold ${span}`;
}

/** The play itself, in the words a market board uses: the side, or the ticker. */
export function recommendedPlay(route: Route): string {
  const option = route.optionPosition;
  if (option) {
    const ticker = option.underlying.toUpperCase();
    switch (option.strategy) {
      case 'long-call': return `Buy ${ticker} call`;
      case 'long-put': return `Buy ${ticker} put`;
      case 'bull-call-spread': return `${ticker} call spread`;
      case 'cash-secured-put': return `Sell ${ticker} put`;
      case 'covered-call': return `${ticker} covered call`;
    }
  }
  const feed = routeFeed(route);
  if (feed?.kind === 'outcome') return `Buy ${feed.side}`;
  if (feed?.kind === 'quote') return `Buy ${feed.symbol.replace(/-USD$/, '')}`;
  return 'Add to plan';
}

/**
 * What VoiceOver reads for a whole card, in the order someone scanning it takes the
 * numbers in. Authored rather than left to RN, which otherwise concatenates every
 * string in layout order and announces a route as fourteen unlabelled fragments.
 */
export function cardAccessibilityLabel({ route, riskWord, odds, probabilityLabel, probabilityValue, stake }: {
  route: Route;
  riskWord: string;
  odds: GoalOdds | null | undefined;
  probabilityLabel: string;
  probabilityValue: string;
  stake: { label: string; value: string } | null;
}): string {
  const parts = [
    `${displayLabel(route.category)} on ${displayLabel(route.platform)}`,
    `${riskWord} risk`,
    odds && odds.badCase > 0 ? `Bad case, ${badCaseNote(odds)}: lose $${formatMoney(odds.badCase)}` : null,
    route.line,
    route.description,
    `${probabilityLabel}: ${probabilityValue}`,
    `${route.meetsTarget ? 'Potential profit' : 'Projected profit, below your goal'} $${formatMoney(route.expectedReturn)}`,
    stake ? `${stake.label === 'USES' ? 'Uses' : 'Needs to hit the goal'} ${stake.value}` : null,
  ];
  return parts.filter(Boolean).join('. ');
}
