import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Accent, Radius, RiskScale, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { debtLiquidityLabel, debtYieldLabel, isDebtRoute } from '@/lib/route-investment-metrics';
import { scoreColor } from '@/lib/score';
import type { GoalScoreBreakdown } from '@/lib/score';
import { Route } from '@/types/routes';

const RISK_LABELS = ['Very Safe', 'Safe', 'Moderate', 'Aggressive', 'Very Aggressive'] as const;

export const riskLabel = (level: number) => RISK_LABELS[level - 1] ?? 'Unknown';
export const riskColor = (level: number) => RiskScale[level - 1] ?? '#808080';

const probColor = (p: number) => (p >= 75 ? '#22C55E' : p >= 50 ? Accent.gold : '#EF4444');
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
  scoreBreakdown: GoalScoreBreakdown;
  onTrack?: () => void;
  onPress?: () => void;
}

function formatMoney(amount: number): string {
  return amount.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function RouteCardInner({ route, requiredInvestment, currentInvestment, scoreBreakdown, onTrack, onPress }: RouteCardProps) {
  const theme = useTheme();
  const rc = riskColor(route.riskLevel);
  const pc = probColor(route.probability);
  const binary = route.lossProfile === 'binary';
  const score = scoreBreakdown.score;
  const sc = scoreColor(score);
  const debt = isDebtRoute(route);
  const debtYield = debtYieldLabel(route, requiredInvestment);
  const debtLiquidity = debtLiquidityLabel(route);
  const needsMoreToHitGoal = !!requiredInvestment && !!currentInvestment && requiredInvestment > currentInvestment;
  const probabilityLabel = route.meetsTarget ? 'Chance of hitting goal' : 'Current amount hits goal';
  const probabilityValue = route.meetsTarget ? `${route.probability}%` : 'No';
  const probabilityWidth = route.meetsTarget ? Math.min(route.probability, 100) : 0;
  const probabilityColor = route.meetsTarget ? pc : Accent.red;

  const Container = onPress ? Pressable : View;

  return (
    <Container
      onPress={onPress}
      className={onPress ? 'active:opacity-90' : undefined}
      style={{
        borderRadius: Radius.xl,
        overflow: 'hidden',
        backgroundColor: theme.backgroundElement,
        borderWidth: 1,
        borderColor: theme.border,
        ...Shadow.card,
      }}>
      {/* Left accent rail with a soft glow cap */}
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: rc }} />

      <View style={{ paddingLeft: 20, paddingRight: 16, paddingTop: 16, paddingBottom: 16, gap: 14 }}>

        {/* Header: identity + risk chip */}
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center gap-3 flex-1">
            <View
              style={{
                width: 38, height: 38, borderRadius: Radius.md,
                backgroundColor: rc + '1A',
                alignItems: 'center', justifyContent: 'center',
              }}>
              <ThemedText style={{ fontSize: 20 }}>{route.emoji}</ThemedText>
            </View>
            <View className="flex-1">
              <ThemedText style={{ fontSize: 14, fontWeight: '700', color: theme.text, letterSpacing: -0.2 }} numberOfLines={1}>
                {route.category}
              </ThemedText>
              <ThemedText style={{ fontSize: 11, color: theme.textTertiary }} numberOfLines={1}>
                {route.platform}
              </ThemedText>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 5 }}>
            <View
              style={{
                flexDirection: 'row', alignItems: 'baseline', gap: 4,
                paddingHorizontal: 9, paddingVertical: 5,
                borderRadius: Radius.md, backgroundColor: sc + '18',
                borderWidth: 1, borderColor: sc + '35',
              }}>
              <ThemedText style={{ fontSize: 16, color: sc, fontWeight: '900', ...MONO }}>{score}</ThemedText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: rc }} />
              <ThemedText style={{ fontSize: 10, color: rc, fontWeight: '700' }}>
                {riskLabel(route.riskLevel)}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* The line (sports / prediction-market bets) */}
        {route.line ? (
          <View
            className="flex-row items-center self-start gap-2"
            style={{ backgroundColor: rc + '14', borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: rc + '33' }}>
            <ThemedText style={{ fontSize: 11 }}>🎟️</ThemedText>
            <ThemedText style={{ fontSize: 13, fontWeight: '800', color: theme.text, letterSpacing: 0.2, ...MONO }}>
              {route.line}
            </ThemedText>
          </View>
        ) : null}

        {/* Why we like it — one concise reason */}
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

        {needsMoreToHitGoal ? (
          <View
            className="flex-row items-center justify-between"
            style={{
              borderRadius: Radius.md,
              paddingHorizontal: 12,
              paddingVertical: 9,
              backgroundColor: theme.backgroundSelected,
            }}>
            <ThemedText style={{ fontSize: 11, color: theme.textTertiary, fontWeight: '700' }}>
              NEED TO HIT GOAL
            </ThemedText>
            <ThemedText style={{ fontSize: 16, color: theme.text, fontWeight: '900', ...MONO }}>
              ${formatMoney(requiredInvestment)}
            </ThemedText>
          </View>
        ) : null}

        {debt ? (
          <View
            className="gap-2"
            style={{
              borderRadius: Radius.md,
              padding: 12,
              backgroundColor: theme.backgroundSelected,
            }}>
            <View className="flex-row justify-between gap-2">
              <DebtFact label="YIELD" value={debtYield ?? 'Check quote'} />
              <DebtFact label="MATURITY" value={route.maturesInDays ? formatMaturity(route.maturesInDays) : 'Flexible'} />
            </View>
            <View className="flex-row justify-between gap-2">
              <DebtFact label="DOWNSIDE" value={route.lossProfile === 'partial' ? 'Capital safer' : 'Can lose stake'} />
              <DebtFact label="LIQUIDITY" value={debtLiquidity ?? 'Check terms'} />
            </View>
            {route.investmentFacts?.yieldSource ? (
              <ThemedText style={{ fontSize: 10.5, color: theme.textTertiary, fontWeight: '700' }} numberOfLines={1}>
                Source: {route.investmentFacts.yieldSource}{route.investmentFacts.yieldAsOf ? ` · ${route.investmentFacts.yieldAsOf}` : ''}
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        {/* Footer: return + loss profile + acquire */}
        <View className="flex-row justify-between items-end">
          <View>
            <View className="flex-row items-center gap-1.5">
              <ThemedText style={{ fontSize: 27, fontWeight: '800', color: '#22C55E', letterSpacing: -0.6, ...MONO }}>
                +${route.expectedReturn}
              </ThemedText>
              <View
                style={{
                  paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.sm,
                  backgroundColor: binary ? Accent.red + '15' : '#22C55E15',
                }}>
                <ThemedText style={{ fontSize: 9.5, fontWeight: '700', color: binary ? Accent.red : '#22C55E', letterSpacing: 0.2 }}>
                  {binary ? 'ALL-OR-NOTHING' : 'CAPITAL SAFE'}
                </ThemedText>
              </View>
            </View>
            <ThemedText style={{ fontSize: 11, color: theme.textTertiary }}>
              {route.meetsTarget ? 'potential profit' : 'below current goal'}{route.maturesInDays ? ` · matures in ${formatMaturity(route.maturesInDays)}` : ''}
            </ThemedText>
          </View>
          {onTrack && (
            <Pressable
              onPress={onTrack}
              style={{
                borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 10,
                backgroundColor: '#22C55E', ...Shadow.card,
              }}
              className="active:opacity-80">
              <ThemedText style={{ fontSize: 13, fontWeight: '800', color: '#06140C' }}>Acquire</ThemedText>
            </Pressable>
          )}
        </View>
      </View>
    </Container>
  );
}

export const RouteCard = memo(RouteCardInner);

function DebtFact({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View className="flex-1">
      <ThemedText style={{ fontSize: 9.5, color: theme.textTertiary, fontWeight: '800' }}>{label}</ThemedText>
      <ThemedText style={{ fontSize: 12, color: theme.text, fontWeight: '800', marginTop: 2 }} numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );
}
