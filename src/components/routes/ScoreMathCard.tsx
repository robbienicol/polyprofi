import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, RiskScale, Semantic } from '@/constants/theme';
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

/** Green at 80+, amber in the middle, red once the score is telling you not to. */
function scoreColor(score: number): string {
  if (score >= 80) return RiskScale[0];
  if (score >= 65) return RiskScale[1];
  if (score >= 50) return RiskScale[2];
  if (score >= 35) return RiskScale[3];
  return RiskScale[4];
}

function scoreVerdict(score: number): string {
  if (score >= 80) return 'Strong fit for this goal';
  if (score >= 65) return 'Good fit for this goal';
  if (score >= 50) return 'Workable, with trade-offs';
  if (score >= 35) return 'Weak fit for this goal';
  return 'Poor fit for this goal';
}

/**
 * The four parts of the score, in the words someone reads them in. `question` is
 * what the part actually answers — the reason the row is there at all.
 */
const PARTS = [
  {
    key: 'reliability',
    label: 'Chance it works',
    question: 'How likely this route is to hit your goal',
  },
  {
    key: 'principalProtection',
    label: 'Money kept safe',
    question: 'How much of your stake survives if it misses',
  },
  {
    key: 'capitalEfficiency',
    label: 'Capital needed',
    question: 'How little you have to put in to get there',
  },
  {
    key: 'timeEfficiency',
    label: 'Speed',
    question: 'How far ahead of your deadline it pays out',
  },
] as const;

/** One part of the score: what it earned, out of what the user's weights allow. */
function PartRow({
  label,
  question,
  earned,
  max,
}: {
  label: string;
  question: string;
  earned: number;
  max: number;
}): React.ReactElement {
  const theme = useTheme();
  // A weight the user dragged to zero contributes nothing and can't be filled;
  // show the row flat rather than dividing by zero.
  const fill = max > 0 ? Math.max(0, Math.min(1, earned / max)) : 0;

  return (
    <View style={{ gap: 4 }}>
      <View className="flex-row justify-between items-baseline" style={{ gap: 8 }}>
        <ThemedText style={{ fontSize: 14, fontWeight: '700', color: theme.text, flexShrink: 1 }}>
          {label}
        </ThemedText>
        <ThemedText style={{ fontSize: 14, fontWeight: '800', color: theme.text, ...MONO }}>
          {formatScoreNumber(earned)}
          <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.textTertiary, ...MONO }}>
            {' '}of {formatScoreNumber(max)} pts
          </ThemedText>
        </ThemedText>
      </View>
      <View
        style={{
          height: 8,
          borderRadius: 4,
          backgroundColor: theme.backgroundSelected,
          overflow: 'hidden',
        }}>
        <View
          style={{
            width: `${fill * 100}%`,
            height: '100%',
            borderRadius: 4,
            backgroundColor: scoreColor(fill * 100),
          }}
        />
      </View>
      <ThemedText style={{ fontSize: 12, lineHeight: 16, color: theme.textSecondary }}>
        {question}
        {max <= 0 ? ' · you told us this one does not matter' : ''}
      </ThemedText>
    </View>
  );
}

/** A correction the sliders can't turn off, said in plain words. */
function AdjustmentRow({ color, children }: { color: string; children: React.ReactNode }): React.ReactElement {
  return (
    <View className="flex-row" style={{ gap: 8 }}>
      <View style={{ width: 3, borderRadius: 2, backgroundColor: color }} />
      <ThemedText style={{ fontSize: 13, lineHeight: 18, color, fontWeight: '600', flex: 1 }}>
        {children}
      </ThemedText>
    </View>
  );
}

export function ScoreMathCard({ scoreBreakdown, requiredInvestment, availableInvestment }: ScoreMathCardProps): React.ReactElement {
  const theme = useTheme();
  const score = scoreBreakdown.score;
  const tint = scoreColor(score);
  const subtotal = scoreBreakdown.rawScore;
  const adjusted = subtotal !== score;

  return (
    <View
      style={{
        borderRadius: Radius.lg,
        padding: 18,
        backgroundColor: theme.backgroundElement,
        borderWidth: 1,
        borderColor: theme.border,
        gap: 16,
      }}>
      <View className="flex-row items-center" style={{ gap: 14 }}>
        <View className="items-center justify-center" style={{ minWidth: 92 }}>
          <ThemedText
            style={{ fontSize: 52, lineHeight: 56, fontWeight: '900', color: tint, letterSpacing: -2, ...MONO }}>
            {score}
          </ThemedText>
          <ThemedText style={{ fontSize: 12, fontWeight: '800', color: theme.textTertiary, ...MONO }}>
            out of 100
          </ThemedText>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <ThemedText style={{ fontSize: 17, fontWeight: '800', color: theme.text, letterSpacing: -0.3 }}>
            {scoreVerdict(score)}
          </ThemedText>
          <ThemedText style={{ fontSize: 13, lineHeight: 18, color: theme.textSecondary }}>
            Every route is scored the same four ways, weighted by what you said matters. Here is
            where this one earned its points.
          </ThemedText>
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: theme.border }} />

      <View style={{ gap: 14 }}>
        {PARTS.map((part) => (
          <PartRow
            key={part.key}
            label={part.label}
            question={part.question}
            earned={scoreBreakdown.contributions[part.key]}
            // The weight is the share of the 100 points this part can ever win.
            max={scoreBreakdown.weights[part.key] * 100}
          />
        ))}
      </View>

      <View style={{ height: 1, backgroundColor: theme.border }} />

      <View style={{ gap: 10 }}>
        <View className="flex-row justify-between items-baseline" style={{ gap: 8 }}>
          <ThemedText style={{ fontSize: 14, fontWeight: '700', color: theme.textSecondary }}>
            {adjusted ? 'Four parts add up to' : 'Total'}
          </ThemedText>
          <ThemedText style={{ fontSize: 16, fontWeight: '800', color: theme.text, ...MONO }}>
            {formatScoreNumber(subtotal)}
          </ThemedText>
        </View>

        {scoreBreakdown.capitalSurvivalFactor != null && scoreBreakdown.capitalSurvivalFactor < 1 ? (
          <AdjustmentRow color={Semantic.caution}>
            Docked for risk to your money: there is a{' '}
            {Math.round(100 - scoreBreakdown.reliability)}% chance this misses, and a miss
            {scoreBreakdown.lossFraction != null && scoreBreakdown.lossFraction < 1
              ? ` costs about ${Math.round(scoreBreakdown.lossFraction * 100)}% of what you put in.`
              : ' costs everything you put in.'}
          </AdjustmentRow>
        ) : null}

        {scoreBreakdown.marketQualityAdjustment ? (
          <AdjustmentRow color={Semantic.caution}>
            Docked for market quality
            {scoreBreakdown.marketQualityAdjustment.deduction > 0
              ? ` (−${formatScoreNumber(scoreBreakdown.marketQualityAdjustment.deduction)} pts)`
              : ''}
            : thin or jumpy pricing makes getting in and out at these numbers less certain.
          </AdjustmentRow>
        ) : null}

        {scoreBreakdown.capReason ? (
          <AdjustmentRow color={Semantic.negative}>
            {scoreBreakdown.capReason === 'over_budget'
              ? `Capped at 49: this needs $${formatMoney(requiredInvestment ?? 0)} and you have $${formatMoney(availableInvestment)} to work with.`
              : scoreBreakdown.capReason === 'misses_deadline'
                ? 'Capped at 39: it pays out after your goal deadline, however well it scores otherwise.'
                : 'Capped at 49: we could not work out how much this route needs.'}
          </AdjustmentRow>
        ) : null}

        {adjusted ? (
          <View className="flex-row justify-between items-baseline" style={{ gap: 8 }}>
            <ThemedText style={{ fontSize: 15, fontWeight: '800', color: theme.text }}>
              Final score
            </ThemedText>
            <ThemedText style={{ fontSize: 20, fontWeight: '900', color: tint, ...MONO }}>
              {score}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </View>
  );
}
