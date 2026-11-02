import React from 'react';
import { View } from 'react-native';

import { useMoney } from '@/api/hooks/usePreferences';
import { InsightCard } from '@/components/portfolio/InsightCard';
import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { MONO } from '@/lib/portfolio-format';
import { cheapestPaths } from '@/lib/portfolio-shape';
import type { TrackedBet } from '@/types/bets';

/**
 * The routes held, ranked by what a dollar of expected profit costs on each.
 *
 * Capital is the constraint people actually hit — not appetite, not ideas — so
 * ranking by efficiency says more about how far the money can get than ranking
 * by payout, which only ever rewards staking more.
 */
export function CheapestPathCard({
  bets,
  conservative,
  remainingToGoal,
}: {
  bets: TrackedBet[];
  conservative: boolean;
  /** What the goals in scope still need. Null when there is no target to close. */
  remainingToGoal: number | null;
}): React.ReactElement | null {
  const theme = useTheme();
  const money = useMoney();
  const paths = cheapestPaths(bets, conservative);
  if (paths.length === 0) return null;

  const best = paths[0];
  // What closing the gap would cost at the best rate you are already getting. A
  // projection off your own positions, not a recommendation to put that in.
  const costToClose = remainingToGoal != null && remainingToGoal > 0
    ? remainingToGoal * best.costPerDollar
    : null;

  return (
    <InsightCard
      title="Cheapest path to your goal"
      metric="cheapestPath"
      subtitle={
        costToClose != null
          ? `At your best rate, the ${money(remainingToGoal as number, { decimals: 0 })} still needed would take about ${money(costToClose, { decimals: 0 })} invested.`
          : 'What a dollar of expected profit costs on each route you hold.'
      }>
      <View style={{ gap: 12 }}>
        {paths.slice(0, 5).map((path, index) => (
          <View key={path.id} className="flex-row items-center" style={{ gap: 10 }}>
            <ThemedText
              style={{ fontSize: 11, fontWeight: '900', color: theme.textTertiary, width: 14, ...MONO }}>
              {index + 1}
            </ThemedText>
            <Icon glyph={path.emoji} size={14} color={theme.textSecondary} />
            <View className="flex-1">
              <ThemedText style={{ fontSize: 13, fontWeight: '700', color: theme.text }} numberOfLines={1}>
                {path.label}
              </ThemedText>
              <ThemedText style={{ fontSize: 11, color: theme.textTertiary, marginTop: 1 }} numberOfLines={1}>
                {money(path.staked, { decimals: 0 })} in ·{' '}
                {path.shape === 'binary'
                  ? 'stake can go to zero'
                  : path.shape === 'protected'
                    ? 'principal not market exposed'
                    : 'market exposed'}
              </ThemedText>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <ThemedText style={{ fontSize: 13, fontWeight: '800', color: theme.text, ...MONO }}>
                {money(path.costPerDollar, { decimals: 2 })}
              </ThemedText>
              <ThemedText style={{ fontSize: 10.5, fontWeight: '700', color: theme.textTertiary }}>
                per $1
              </ThemedText>
            </View>
          </View>
        ))}
      </View>

      {/* Said plainly and next to the ranking, because "cheapest" invites exactly
          one dangerous reading and it is better answered here than in the sheet. */}
      <ThemedText style={{ fontSize: 11, lineHeight: 15, color: theme.textTertiary }}>
        Cheapest is not safest — read each line against what it says can be lost.
      </ThemedText>
    </InsightCard>
  );
}
