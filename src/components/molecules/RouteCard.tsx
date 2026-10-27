import { Plus } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { useRouteLive } from '@/api/hooks/useRouteLive';
import { LiveBadge, LiveQuote, Sparkline, SparklinePlaceholder } from '@/components/molecules/Sparkline';
import { OutcomePill } from '@/components/molecules/route-card/OutcomePill';
import {
  cardAccessibilityLabel,
  chanceTone,
  displayLabel,
  displayRiskLevel,
  formatMoney,
  formatProbability,
  maturityColor,
  maturityWords,
  recommendedPlay,
  riskColor,
  riskLabel,
} from '@/components/molecules/route-card/route-card-format';
import { Icon } from '@/components/ui/Icon';
import { routeIcon } from '@/components/ui/route-icons';
import { Haptic } from '@/lib/haptics';
import { ThemedText } from '@/components/themed-text';
import { Radius, Shadow } from '@/constants/theme';
import { useRiskTextScale, useTheme } from '@/hooks/use-theme';
import { predictionTopic } from '@/lib/prediction-topics';
import type { GoalOdds } from '@/lib/goal-odds';
import { Route } from '@/types/routes';

export {
  displayRiskLevel,
  formatMaturity,
  formatProbability,
  maturityColor,
  riskColor,
  riskLabel,
  shortMaturity,
} from '@/components/molecules/route-card/route-card-format';

const MONO = { fontVariant: ['tabular-nums' as const] };

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

export const RouteCard = memo(RouteCardInner);
