import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Accent, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { GoalScoreBreakdown } from '@/lib/score';

const MONO = { fontVariant: ['tabular-nums' as const] };

interface ScoreMathCardProps {
  scoreBreakdown: GoalScoreBreakdown;
  requiredInvestment: number | null;
  availableInvestment: number;
}

function formatMoney(amount: number): string {
  return amount.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatScoreNumber(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
}

export function ScoreMathCard({ scoreBreakdown, requiredInvestment, availableInvestment }: ScoreMathCardProps): React.ReactElement {
  const theme = useTheme();
  const score = scoreBreakdown.score;

  return (
    <View
      style={{
        borderRadius: Radius.lg,
        padding: 14,
        backgroundColor: theme.backgroundElement,
        borderWidth: 1,
        borderColor: theme.border,
        gap: 6,
      }}>
      <View className="flex-row justify-between items-center">
        <ThemedText style={{ fontSize: 10, color: theme.textTertiary, fontWeight: '800', letterSpacing: 0.6 }}>
          SCORE MATH
        </ThemedText>
        <ThemedText style={{ fontSize: 15, color: theme.text, fontWeight: '900', ...MONO }}>
          {score}/100
        </ThemedText>
      </View>
      <ThemedText style={{ fontSize: 10, color: theme.textTertiary, fontWeight: '700' }}>
        35% chance · 25% safety · 30% capital · 10% time
      </ThemedText>
      <ThemedText style={{ fontSize: 11, color: theme.textSecondary, ...MONO }}>
        Chance / safety / capital / time: {formatScoreNumber(scoreBreakdown.reliability)} · {formatScoreNumber(scoreBreakdown.principalProtection)} · {formatScoreNumber(scoreBreakdown.capitalEfficiency)} · {formatScoreNumber(scoreBreakdown.timeEfficiency)}
      </ThemedText>
      <ThemedText style={{ fontSize: 12, color: theme.text, fontWeight: '800', ...MONO }}>
        {formatScoreNumber(scoreBreakdown.contributions.reliability)} + {formatScoreNumber(scoreBreakdown.contributions.principalProtection)} + {formatScoreNumber(scoreBreakdown.contributions.capitalEfficiency)} + {formatScoreNumber(scoreBreakdown.contributions.timeEfficiency)} = {formatScoreNumber(scoreBreakdown.rawScore)}{scoreBreakdown.rawScore !== score ? ` → ${score}` : ''}
      </ThemedText>
      {scoreBreakdown.allOrNothingFactor != null && scoreBreakdown.allOrNothingFactor < 1 ? (
        <ThemedText style={{ fontSize: 11, color: Accent.gold, fontWeight: '700', ...MONO }}>
          All-or-nothing: ×{scoreBreakdown.allOrNothingFactor.toFixed(2)} — a miss loses your full stake ({Math.round((1 - scoreBreakdown.allOrNothingFactor) * 100)}% chance)
        </ThemedText>
      ) : null}
      {scoreBreakdown.marketQualityAdjustment ? (
        <ThemedText style={{ fontSize: 11, color: Accent.gold, fontWeight: '700', ...MONO }}>
          Market quality: ×{scoreBreakdown.marketQualityAdjustment.factor.toFixed(3)}
          {scoreBreakdown.marketQualityAdjustment.executionScore != null
            ? ` · execution ${formatScoreNumber(scoreBreakdown.marketQualityAdjustment.executionScore)}/100`
            : ''}
          {scoreBreakdown.marketQualityAdjustment.stabilityScore != null
            ? ` · stability ${formatScoreNumber(scoreBreakdown.marketQualityAdjustment.stabilityScore)}/100`
            : ''}
          {scoreBreakdown.marketQualityAdjustment.deduction > 0
            ? ` · −${formatScoreNumber(scoreBreakdown.marketQualityAdjustment.deduction)} pts`
            : ''}
        </ThemedText>
      ) : null}
      {scoreBreakdown.capReason ? (
        <ThemedText style={{ fontSize: 11, color: Accent.red, fontWeight: '700' }}>
          {scoreBreakdown.capReason === 'over_budget'
            ? `Needs $${formatMoney(requiredInvestment ?? 0)} but your current limit is $${formatMoney(availableInvestment)} · capped at 49`
            : scoreBreakdown.capReason === 'misses_deadline'
              ? 'Matures after your goal deadline · capped at 39'
              : 'Required investment could not be calculated · capped at 49'}
        </ThemedText>
      ) : null}
    </View>
  );
}
