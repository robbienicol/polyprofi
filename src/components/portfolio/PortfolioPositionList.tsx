import React from 'react';
import { Pressable, View } from 'react-native';

import { useMoney } from '@/api/hooks/usePreferences';
import { compactAssetClass } from '@/components/portfolio/PortfolioVisuals';
import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { Brand, OnBrand, Radius, Semantic, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MONO } from '@/lib/portfolio-format';
import type { PositionValuation } from '@/lib/portfolio-progress';
import type { TrackedBet } from '@/types/bets';

type ResolveHandler = (args: { id: string; status: TrackedBet['status'] }) => void;

/** The positions section: the first five active positions, or a way in when none are. */
export function PortfolioPositionList({
  bets,
  activeBets,
  positionById,
  onFindRoutes,
  onOpenPositions,
  onOpenPosition,
  onResolve,
}: {
  bets: TrackedBet[];
  activeBets: TrackedBet[];
  positionById?: Record<string, PositionValuation>;
  onFindRoutes: () => void;
  onOpenPositions: () => void;
  onOpenPosition?: (betId: string) => void;
  onResolve?: ResolveHandler;
}): React.ReactElement {
  const theme = useTheme();

  if (activeBets.length === 0) {
    return (
      <View style={{ gap: 10 }}>
        <Pressable
          onPress={onFindRoutes}
          className="py-4 items-center active:opacity-85"
          style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], ...Shadow.card }}>
          <ThemedText style={{ fontSize: 14, fontWeight: '800', color: OnBrand }}>
            Put your cash to work →
          </ThemedText>
        </Pressable>
        {/* Nothing is working, but closed positions still are the record of what
            happened. Without this the history has no way in once the last position
            settles. */}
        {bets.length > 0 ? (
          <Pressable onPress={onOpenPositions} className="items-center py-1 active:opacity-60">
            <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary }}>
              View past positions
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <View className="flex-row items-center justify-between" style={{ paddingHorizontal: 6 }}>
        <ThemedText style={{ fontSize: 11, fontWeight: '800', color: theme.textTertiary, letterSpacing: 0.9 }}>
          ACTIVE POSITIONS
        </ThemedText>
        <Pressable onPress={onOpenPositions} className="active:opacity-60">
          <ThemedText style={{ fontSize: 12, fontWeight: '800', color: Brand[500] }}>Manage →</ThemedText>
        </Pressable>
      </View>

      {activeBets.slice(0, 5).map((bet) => (
        <PositionRow
          key={bet.id}
          bet={bet}
          valuation={positionById?.[bet.id]}
          onPress={() => (onOpenPosition ? onOpenPosition(bet.id) : onOpenPositions())}
          onResolve={onResolve}
        />
      ))}

      {activeBets.length > 5 ? (
        <Pressable onPress={onOpenPositions} className="items-center py-2 active:opacity-60">
          <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary }}>
            View all {activeBets.length} positions
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * One active position, with the two things you can do to it from here: open it, or
 * say how it ended.
 *
 * The figure on the right used to be the route's expected payout, in green, next to
 * the amount staked and labelled as neither — so a position that was down still read
 * as money made. Where a live price exists the row now reports the actual unrealised
 * P&L, and where one does not it says the number is a forecast rather than colouring
 * it like a result.
 */
function PositionRow({
  bet,
  valuation,
  onPress,
  onResolve,
}: {
  bet: TrackedBet;
  valuation?: PositionValuation;
  onPress: () => void;
  onResolve?: ResolveHandler;
}): React.ReactElement {
  const theme = useTheme();
  const money = useMoney();
  const live = valuation?.pricing === 'live' || valuation?.pricing === 'projected';
  const pnl = valuation?.unrealizedPnl ?? 0;
  const up = pnl >= 0;

  return (
    <View
      style={{
        borderRadius: Radius.lg,
        backgroundColor: theme.backgroundElement,
        borderWidth: 1,
        borderColor: theme.border,
        overflow: 'hidden',
      }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Open ${bet.description}`}
        className="active:opacity-80"
        style={{
          paddingHorizontal: 14,
          paddingVertical: 13,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: Radius.sm,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.backgroundSelected,
          }}>
          <Icon glyph={bet.emoji} size={17} color={theme.textSecondary} />
        </View>
        <View className="flex-1" style={{ gap: 2 }}>
          <ThemedText style={{ fontSize: 14, fontWeight: '700', color: theme.text }} numberOfLines={1}>
            {bet.description}
          </ThemedText>
          <ThemedText style={{ fontSize: 11, color: theme.textTertiary }} numberOfLines={1}>
            {positionMeta(bet.category, bet.platform, bet.probability)}
          </ThemedText>
        </View>
        <View className="items-end" style={{ gap: 1 }}>
          <ThemedText style={{ fontSize: 14, fontWeight: '800', color: theme.text, ...MONO }}>
            {money(bet.amountWagered, { decimals: 0 })}
          </ThemedText>
          <ThemedText style={{ fontSize: 10, color: theme.textTertiary }}>staked</ThemedText>
          <ThemedText
            style={{
              fontSize: 12,
              fontWeight: '700',
              marginTop: 2,
              color: live ? (up ? Semantic.positive : Semantic.negative) : theme.textSecondary,
              ...MONO,
            }}>
            {money(live ? pnl : bet.expectedReturn, { decimals: 0, signed: true })}
          </ThemedText>
          <ThemedText style={{ fontSize: 10, color: theme.textTertiary }}>
            {live ? 'now' : 'if it wins'}
          </ThemedText>
        </View>
      </Pressable>

      {onResolve ? (
        <View
          className="flex-row"
          style={{ borderTopWidth: 1, borderTopColor: theme.border }}>
          <ResolveAction
            label="Won"
            color={Semantic.positive}
            onPress={() => onResolve({ id: bet.id, status: 'won' })}
          />
          <ResolveAction
            label="Lost"
            color={theme.textSecondary}
            onPress={() => onResolve({ id: bet.id, status: 'lost' })}
            divided
          />
          <ResolveAction
            label="Didn't invest"
            color={theme.textSecondary}
            onPress={() => onResolve({ id: bet.id, status: 'watching' })}
            divided
          />
        </View>
      ) : null}
    </View>
  );
}

function ResolveAction({
  label,
  color,
  onPress,
  divided,
}: {
  label: string;
  color: string;
  onPress: () => void;
  /** Hairline against the action to its left. */
  divided?: boolean;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-1 items-center active:opacity-60"
      style={{
        paddingVertical: 10,
        borderLeftWidth: divided ? 1 : 0,
        borderLeftColor: theme.border,
      }}>
      <ThemedText style={{ fontSize: 12, fontWeight: '700', color }}>{label}</ThemedText>
    </Pressable>
  );
}

/** "Stocks · Robinhood · 71% chance", minus the class when it just repeats the venue. */
function positionMeta(category: string, platform: string, probability: number): string {
  const assetClass = compactAssetClass(category);
  const parts = assetClass.toLowerCase() === platform.toLowerCase() ? [platform] : [assetClass, platform];
  return [...parts, `${probability}% chance`].join(' · ');
}
