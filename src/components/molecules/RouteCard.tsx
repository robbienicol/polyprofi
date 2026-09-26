import { Bitcoin, ChartNoAxesColumn, CreditCard, Landmark, Scissors, TrendingUp, type LucideIcon } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { Brand, Colors, OnBrand, Radius, RiskScale, Semantic, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { predictionTopic } from '@/lib/prediction-topics';
import { Route } from '@/types/routes';

const RISK_LABELS = ['Very Safe', 'Safe', 'Moderate', 'Aggressive', 'Very Aggressive'] as const;

export const riskLabel = (level: number) => RISK_LABELS[level - 1] ?? 'Unknown';
export const riskColor = (level: number) => RiskScale[level - 1] ?? Colors.light.textSecondary;

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

const probColor = (p: number) => (p >= 75 ? Semantic.positive : p >= 50 ? Semantic.caution : Semantic.negative);
const MONO = { fontVariant: ['tabular-nums' as const] };

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
   * The route's score out of 100 under the user's own weighting. Omitted where there
   * is no goal to score against — a score with no context behind it is a number
   * pretending to mean something.
   */
  score?: number | null;
  onTrack?: () => void;
  onPress?: () => void;
}

/** Bands, not a gradient: a 61 and a 64 are the same answer. */
const scoreColor = (score: number): string =>
  score >= 75 ? Semantic.positive : score >= 50 ? Semantic.caution : Semantic.negative;

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
 * The mark for a route, chosen by what the route is rather than by the emoji the
 * model happened to emit — the same kind of route always wears the same icon.
 */
function routeIcon(route: Route): LucideIcon | undefined {
  if (route.spendingCut) return Scissors;
  if (route.cardRewards) return CreditCard;
  if (/polymarket|prediction|kalshi/i.test(`${route.category} ${route.platform}`)) return ChartNoAxesColumn;
  if (/crypto/i.test(route.category)) return Bitcoin;
  if (/savings|treasur/i.test(route.category)) return Landmark;
  if (/stock|etf/i.test(route.category)) return TrendingUp;
  return undefined;
}

/**
 * One route in the results list: what it is, why, its chance, and the two numbers
 * that decide it — what it could make and what it takes. Risk bands, loss profile,
 * yield, maturity and liquidity all live on the detail screen; on the list they were
 * a wall of labels between the reader and those two numbers.
 */
function RouteCardInner({ route, requiredInvestment, currentInvestment, score, onTrack, onPress }: RouteCardProps) {
  const theme = useTheme();
  const pc = probColor(route.probability);
  const needsMoreToHitGoal = !!requiredInvestment && !!currentInvestment && requiredInvestment > currentInvestment;
  // What this route will actually put in: only what it needs, capped by the amount
  // the user is willing to invest. Shown always, so moving "willing to invest"
  // visibly changes the card.
  const stakeUsed = requiredInvestment != null && currentInvestment != null && !needsMoreToHitGoal
    ? Math.min(requiredInvestment, currentInvestment)
    : null;
  // The topic comes from the market's own tags; shown when present, never guessed.
  const topic = predictionTopic(route.predictionTopic);
  const probabilityLabel = route.meetsTarget ? 'Chance of hitting goal' : 'Current amount hits goal';
  const probabilityValue = route.meetsTarget ? formatProbability(route.probability) : 'No';
  const probabilityWidth = route.meetsTarget ? Math.min(route.probability, 100) : 0;
  const probabilityColor = route.meetsTarget ? pc : Semantic.negative;

  const stake = route.noCapitalRequired
    ? { label: 'USES', value: 'No money', color: theme.text }
    : needsMoreToHitGoal
      ? { label: 'TO HIT GOAL', value: `$${formatMoney(requiredInvestment!)}`, color: Semantic.caution }
      : stakeUsed != null
        ? { label: 'USES', value: `$${formatMoney(stakeUsed)}`, color: theme.text }
        : null;

  const Container = onPress ? Pressable : View;

  return (
    <Container
      onPress={onPress}
      className={onPress ? 'active:opacity-90' : undefined}
      style={{
        borderRadius: Radius.xl,
        backgroundColor: theme.backgroundElement,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 16,
        gap: 12,
        ...Shadow.card,
      }}>
      {/* Header: what it is, where, and its score */}
      <View className="flex-row items-center" style={{ gap: 12 }}>
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
        <View className="flex-1">
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
          <ThemedText style={{ fontSize: 11, color: theme.textTertiary }} numberOfLines={1}>
            {displayLabel(route.platform)}
          </ThemedText>
        </View>
        {score != null ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              gap: 2,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: Radius.pill,
              backgroundColor: scoreColor(score) + '1A',
            }}>
            <ThemedText style={{ fontSize: 13, fontWeight: '900', color: scoreColor(score), ...MONO }}>
              {score}
            </ThemedText>
            <ThemedText style={{ fontSize: 9, fontWeight: '800', color: theme.textTertiary, letterSpacing: 0.3 }}>
              /100
            </ThemedText>
          </View>
        ) : null}
      </View>

      {/* The contract price a prediction-market route trades at */}
      {route.line ? (
        <View
          className="self-start"
          style={{ backgroundColor: theme.backgroundSelected, borderRadius: Radius.sm, paddingHorizontal: 9, paddingVertical: 5 }}>
          <ThemedText style={{ fontSize: 12.5, fontWeight: '800', color: theme.text, letterSpacing: 0.2, ...MONO }}>
            {route.line}
          </ThemedText>
        </View>
      ) : null}

      <ThemedText style={{ fontSize: 13.5, color: theme.textSecondary, lineHeight: 20 }} numberOfLines={2}>
        {route.description}
      </ThemedText>

      {/* Probability meter */}
      <View className="gap-1.5">
        <View className="flex-row justify-between">
          <ThemedText style={{ fontSize: 11, color: theme.textSecondary, fontWeight: '500' }}>{probabilityLabel}</ThemedText>
          <ThemedText style={{ fontSize: 11, color: probabilityColor, fontWeight: '800', ...MONO }}>{probabilityValue}</ThemedText>
        </View>
        <View style={{ height: 6, borderRadius: Radius.pill, backgroundColor: theme.backgroundSelected, overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${probabilityWidth}%`, borderRadius: Radius.pill, backgroundColor: probabilityColor }} />
        </View>
      </View>

      {/* The two numbers that decide it, side by side: what it could make, what it takes */}
      <View
        className="flex-row items-end"
        style={{ gap: 16, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12 }}>
        <View className="flex-1">
          <ThemedText style={{ fontSize: 10, fontWeight: '800', color: theme.textTertiary, letterSpacing: 0.4 }}>
            {route.meetsTarget ? 'POTENTIAL PROFIT' : 'PROFIT · BELOW GOAL'}
          </ThemedText>
          <ThemedText style={{ fontSize: 26, fontWeight: '800', color: Semantic.positive, letterSpacing: -0.6, marginTop: 1, ...MONO }}>
            +${formatMoney(route.expectedReturn)}
          </ThemedText>
        </View>
        {stake ? (
          <View style={{ paddingBottom: 3 }}>
            <ThemedText style={{ fontSize: 10, fontWeight: '800', color: theme.textTertiary, letterSpacing: 0.4 }}>
              {stake.label}
            </ThemedText>
            <ThemedText style={{ fontSize: 16, fontWeight: '800', color: stake.color, marginTop: 2, ...MONO }}>
              {stake.value}
            </ThemedText>
          </View>
        ) : null}
        {onTrack && (
          <Pressable
            onPress={onTrack}
            style={{ borderRadius: Radius.md, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: Brand[500] }}
            className="active:opacity-80">
            <ThemedText style={{ fontSize: 13, fontWeight: '800', color: OnBrand }}>Add</ThemedText>
          </Pressable>
        )}
      </View>
    </Container>
  );
}

export const RouteCard = memo(RouteCardInner);
