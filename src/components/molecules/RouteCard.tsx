import { Plus, type LucideIcon } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { routeFeed, useRouteLive } from '@/api/hooks/useRouteLive';
import { LiveBadge, LiveQuote, Sparkline, SparklinePlaceholder } from '@/components/molecules/Sparkline';
import { Icon } from '@/components/ui/Icon';
import { routeIcon } from '@/components/ui/route-icons';
import { Haptic } from '@/lib/haptics';
import { ThemedText } from '@/components/themed-text';
import { CategoryScale, Colors, Radius, RiskScale, Semantic, Shadow } from '@/constants/theme';
import { useRiskTextScale, useSemanticText, useTheme } from '@/hooks/use-theme';
import { predictionTopic } from '@/lib/prediction-topics';
import type { GoalOdds } from '@/lib/goal-odds';
import { Route } from '@/types/routes';

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

const MONO = { fontVariant: ['tabular-nums' as const] };

/** The chance, coded the way a quote board codes it: likely green, coin-flip amber, long shot red. */
type ChanceTone = 'positive' | 'caution' | 'negative';
function chanceTone(percent: number): ChanceTone {
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

interface RouteCardProps {
  route: Route;
  requiredInvestment?: number | null;
  currentInvestment?: number | null;
  /**
   * Chance of reaching the goal at a stake inside the user's loss cap, with that stake
   * and its bad case. Omitted where there is no goal — odds of nothing mean nothing.
   */
  odds?: GoalOdds | null;
  /** The goal's profit, for the words around the odds. */
  target?: number | null;
  /** Called with this card's route, so one stable handler serves the whole list. */
  onTrack?: (route: Route) => void;
  onPress?: (route: Route) => void;
}

function formatMoney(amount: number): string {
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
function displayLabel(value: string): string {
  return value === 'Polymarket' ? 'Prediction market' : value;
}

/**
 * What VoiceOver reads for a whole card, in the order someone scanning it takes the
 * numbers in. Authored rather than left to RN, which otherwise concatenates every
 * string in layout order and announces a route as fourteen unlabelled fragments.
 */
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
function maturityWords(route: Route): string {
  const span = shortMaturity(route.maturesInDays ?? 0);
  if (route.sourceSlug || route.optionPosition) return `Pays out in ${span}`;
  if (/savings|treasur/i.test(route.category)) return `Matures in ${span}`;
  return `Hold ${span}`;
}

/** The play itself, in the words a market board uses: the side, or the ticker. */
function recommendedPlay(route: Route): string {
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

function cardAccessibilityLabel({ route, riskWord, odds, probabilityLabel, probabilityValue, stake }: {
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

/**
 * One route in the results list: what it is, how risky, its chance, and the two
 * numbers that decide it — what it could make and what it takes. Loss profile,
 * yield, maturity and liquidity live on the detail screen; on the list they were a
 * wall of labels between the reader and those numbers.
 *
 * Risk is the one thing that does not live a screen away. It is what the whole list
 * is ranked along and the only reason a T-bill and an all-or-nothing contract can
 * share a surface, so it is also the only hue on the card: the score reads as a word,
 * the meter and the profit figure stay in ink. A column of bands down the list is the
 * ramp, made scannable — and it never says "good", only "how much can go wrong".
 */
function RouteCardInner({ route, requiredInvestment, currentInvestment, odds, target, onTrack, onPress }: RouteCardProps) {
  const theme = useTheme();
  const riskInk = useRiskTextScale();
  const { live, loading: liveLoading } = useRouteLive(route);
  const riskLevel = displayRiskLevel(route);
  const riskWord = riskLabel(riskLevel);
  const needsMoreToHitGoal = !!requiredInvestment && !!currentInvestment && requiredInvestment > currentInvestment;
  // What this route will actually put in: only what it needs, capped by the amount
  // the user is willing to invest. Shown always, so moving "willing to invest"
  // visibly changes the card.
  const stakeUsed = requiredInvestment != null && currentInvestment != null && !needsMoreToHitGoal
    ? Math.min(requiredInvestment, currentInvestment)
    : null;
  // The topic comes from the market's own tags; shown when present, never guessed.
  const topic = predictionTopic(route.predictionTopic);
  const goalWords = target ? `$${formatMoney(target)}` : 'your goal';
  // Short of the goal at this size, it still has odds of paying what it can — hiding
  // them left a card that said only "No".
  const probabilityLabel = odds
    ? odds.hitsGoal ? `Chance you hit ${goalWords}` : `Chance it pays $${formatMoney(odds.profitIfItWorks)}`
    : route.meetsTarget ? 'Chance of hitting goal' : 'Current amount hits goal';
  const probabilityValue = odds
    ? formatProbability(odds.hitsGoal ? odds.chance : route.probability)
    : route.meetsTarget ? formatProbability(route.probability) : 'No';
  const probabilityWidth = odds
    ? Math.min(odds.hitsGoal ? odds.chance : route.probability, 100)
    : route.meetsTarget ? Math.min(route.probability, 100) : 0;
  const tone = chanceTone(probabilityWidth);
  const play = recommendedPlay(route);

  const stake = odds
    ? { label: 'STAKE', value: odds.stake > 0 ? `$${formatMoney(odds.stake)}` : 'No money' }
    : route.noCapitalRequired
    ? { label: 'USES', value: 'No money' }
    : needsMoreToHitGoal
      ? { label: 'TO HIT GOAL', value: `$${formatMoney(requiredInvestment!)}` }
      : stakeUsed != null
        ? { label: 'USES', value: `$${formatMoney(stakeUsed)}` }
        : null;

  const Content = onPress ? Pressable : View;

  return (
    /*
     * The card is `accessible={false}` so its two jobs stay two separate stops for a
     * screen reader. With the default, iOS folds the whole card into one node and the
     * Add button inside it stops being focusable at all — the primary action of the
     * primary screen, unreachable.
     */
    <View
      accessible={false}
      style={{
        borderRadius: Radius.xl,
        backgroundColor: theme.backgroundElement,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 16,
        ...Shadow.card,
      }}>
      <Content
        onPress={onPress ? () => { Haptic.tap(); onPress(route); } : undefined}
        accessible
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={cardAccessibilityLabel({ route, riskWord, odds, probabilityLabel, probabilityValue, stake })}
        accessibilityHint={onPress ? 'Opens where the odds come from, the risk and the exit plan' : undefined}
        className={onPress ? 'active:opacity-90' : undefined}
        style={{ gap: 12 }}>
        {/* Header: what it is, how risky, and how well it fits the goal */}
        <View className="flex-row items-start" style={{ gap: 12 }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: Radius.md,
              backgroundColor: theme.backgroundSelected,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon icon={routeIcon(route)} glyph={route.emoji} size={18} color={theme.text} strokeWidth={1.75} />
          </View>
          <View className="flex-1" style={{ gap: 4 }}>
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <ThemedText style={{ fontSize: 14, fontWeight: '700', color: theme.text, letterSpacing: -0.2 }} numberOfLines={1}>
                {displayLabel(route.category)}
              </ThemedText>
              {topic ? (
                <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.textTertiary }} numberOfLines={1}>
                  · {topic.label}
                </ThemedText>
              ) : null}
            </View>
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <View
                style={{
                  borderRadius: Radius.sm,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  backgroundColor: riskColor(riskLevel) + '1F',
                }}>
                <ThemedText style={{ fontSize: 11, fontWeight: '800', color: riskInk[riskLevel - 1], letterSpacing: 0.2 }}>
                  {riskWord}
                </ThemedText>
              </View>
              {route.maturesInDays != null && route.maturesInDays > 0 ? (
                <View className="flex-row items-center flex-1" style={{ gap: 4 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: maturityColor(route.maturesInDays) }} />
                  <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, ...MONO }} numberOfLines={1}>
                    {maturityWords(route)}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>
          {live && !(odds && !odds.hitsGoal) ? <LiveBadge /> : null}
          {odds && !odds.hitsGoal ? (
            <View style={{ alignItems: 'flex-end', gap: 1 }}>
              {live ? <LiveBadge /> : null}
              <ThemedText style={{ fontSize: 22, fontWeight: '900', color: theme.textTertiary, letterSpacing: -0.6, ...MONO }}>
                ${formatMoney(odds.profitIfItWorks)}
              </ThemedText>
              <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary }}>of {goalWords}</ThemedText>
            </View>
          ) : null}
        </View>

        <ThemedText style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 20 }} numberOfLines={2}>
          {route.description}
        </ThemedText>

        {/* What it makes, with the live market for what it buys beside it */}
        <View className="flex-row items-center" style={{ gap: 14 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.textTertiary, letterSpacing: 0.4 }}>
              {odds ? 'IF IT WORKS' : route.meetsTarget ? 'POTENTIAL PROFIT' : 'PROFIT · BELOW GOAL'}
            </ThemedText>
            <ThemedText style={{ fontSize: 24, fontWeight: '800', color: theme.text, letterSpacing: -0.6, ...MONO }}>
              +${formatMoney(odds ? odds.profitIfItWorks : route.expectedReturn)}
            </ThemedText>
            {live ? <LiveQuote live={live} /> : null}
            {stake ? (
              <ThemedText style={{ fontSize: 12, color: theme.textTertiary, ...MONO }}>
                {stake.label === 'STAKE' ? 'Stake' : stake.label === 'USES' ? 'Uses' : 'To hit goal'} {stake.value}
              </ThemedText>
            ) : null}
          </View>
          {live ? (
            <View style={{ flex: 1 }}>
              <Sparkline live={live} height={64} />
            </View>
          ) : liveLoading ? (
            <View style={{ flex: 1 }}>
              <SparklinePlaceholder height={64} />
            </View>
          ) : null}
        </View>
      </Content>

      {/* One pill: the play we recommend and its chance, the card's action. */}
      {onTrack || onPress ? (
        <View style={{ marginTop: 14 }}>
          <OutcomePill
            tone={probabilityWidth > 0 ? tone : null}
            icon={onTrack ? Plus : undefined}
            label={play}
            value={probabilityWidth > 0 ? probabilityValue : undefined}
            onPress={onTrack ? () => onTrack(route) : onPress ? () => onPress(route) : undefined}
            accessibilityLabel={`${onTrack ? 'Add' : 'Open'} ${play}. ${probabilityLabel}: ${probabilityValue}`}
            accessibilityHint={onTrack ? 'Asks how much before anything is recorded' : undefined}
          />
        </View>
      ) : null}
    </View>
  );
}

/**
 * A big outlined pill in the outcome's colour, word and chance side by side. Sized
 * and tinted to read as the thing to tap — the card's actions, not its footnotes.
 */
function OutcomePill({ tone, icon, label, value, onPress, accessibilityLabel, accessibilityHint }: {
  tone: ChanceTone | null;
  icon?: LucideIcon;
  label: string;
  value?: string;
  onPress?: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
}) {
  const theme = useTheme();
  const ink = useSemanticText();
  const color = tone ? ink[tone] : theme.text;
  const fill = tone ? Semantic[tone] : theme.text;
  return (
    <Pressable
      onPress={onPress ? () => { Haptic.tap(); onPress(); } : undefined}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      className="active:opacity-70"
      style={{
        flex: 1,
        minHeight: 48,
        borderRadius: Radius.pill,
        borderWidth: 1.5,
        borderColor: fill + '59',
        backgroundColor: fill + '12',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 12,
      }}>
      {icon ? <Icon icon={icon} size={15} color={color} strokeWidth={2.5} /> : null}
      <ThemedText style={{ fontSize: 15, fontWeight: '800', color, ...MONO }} numberOfLines={1}>
        {value ? `${label} · ${value}` : label}
      </ThemedText>
    </Pressable>
  );
}

export const RouteCard = memo(RouteCardInner);
