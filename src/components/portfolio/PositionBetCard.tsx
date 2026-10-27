import React, { memo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useMoney } from '@/api/hooks/usePreferences';
import { riskColor, riskLabel } from '@/components/molecules/RouteCard';
import {
  MonitorPanel,
  ResolveButtons,
  SellAlertBanner,
  StockQuotePanel,
} from '@/components/portfolio/PositionCardPanels';
import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Semantic, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { effectiveEntryPrice, monitoredProfitGoal, positionTargetProfit } from '@/lib/bet-monitor-match';
import { isPredictionMarketBet } from '@/lib/parse-bet-line';
import { MONO } from '@/lib/portfolio-format';
import type { PositionValuation } from '@/lib/portfolio-progress';
import { isStockOrEtfCategory } from '@/lib/tracked-assets';
import type { BetLiveStatus, TrackedBet } from '@/types/bets';

// The goal and the target on a card have to be the same number the position can
// actually pay: a $1,000 stake at 92¢ tops out at +$87, so showing it working
// toward a $100 quiz target asked for $856 the contract can never return.
function profitGoalFor(bet: TrackedBet): number {
  return monitoredProfitGoal(bet, effectiveEntryPrice(bet));
}

function targetProfitFor(bet: TrackedBet): number {
  return positionTargetProfit(bet, effectiveEntryPrice(bet));
}

interface BetCardProps {
  bet: TrackedBet;
  liveStatus?: BetLiveStatus;
  valuation?: PositionValuation;
  /** The position a notification pointed at — ringed so it is findable at a glance. */
  highlighted?: boolean;
  onResolve: (args: { id: string; status: TrackedBet['status'] }) => void;
  onDismissSell: () => void;
}

function BetCardInner({ bet, liveStatus, valuation, highlighted, onResolve, onDismissSell }: BetCardProps): React.ReactElement {
  const theme = useTheme();
  const money = useMoney();
  const rc = riskColor(bet.riskLevel);
  const goal = profitGoalFor(bet);
  const isActive = bet.status === 'active';
  const showSell = isActive && liveStatus?.sellRecommended;
  const isPoly = isPredictionMarketBet(bet);
  const isStock = isStockOrEtfCategory(bet.category);
  const showStockQuote = isActive && isStock && valuation?.pricing === 'live';
  const isSyntheticDescription = isStock && !!valuation?.symbol;
  const displayedDescription = isSyntheticDescription
    ? `${valuation!.symbol} position tracked at ${valuation!.entryPrice != null ? `$${valuation!.entryPrice.toFixed(2)} per share` : 'its recorded entry price'}`
    : bet.description;
  // The live-quote block already states symbol and entry price — don't repeat it above.
  const showDescription = !(showStockQuote && isSyntheticDescription);
  // Once a stock position has a live quote, the card swaps its description for the
  // synthetic "SYM tracked at $X" line above — which is exactly why "what did I even
  // buy this for" happens: the actual pick and the AI's reasoning are still on the
  // bet, just no longer shown anywhere. Tapping the card reveals them again.
  const [expanded, setExpanded] = useState(false);
  const openedAt = bet.positionOpenedAt ?? bet.createdAt;

  return (
    <View className="gap-2">
      {showSell && liveStatus && (
        <SellAlertBanner
          bet={bet}
          liveStatus={liveStatus}
          goal={goal}
          isPoly={isPoly}
          onResolve={onResolve}
          onDismissSell={onDismissSell}
        />
      )}

      <View
        style={{
          borderRadius: Radius.lg,
          overflow: 'hidden',
          backgroundColor: theme.backgroundElement,
          // A sell alert is louder than a "you're up" arrival, so it keeps the
          // gold when both are true.
          borderWidth: showSell || highlighted ? 1.5 : 1,
          borderColor: showSell ? Semantic.caution + '55' : highlighted ? Brand[500] : theme.border,
          ...Shadow.card,
        }}>
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: rc }} />
        <View style={{ paddingLeft: 18, paddingRight: 14, paddingVertical: 14, gap: 12 }}>

          <Pressable
            onPress={() => setExpanded((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Hide position details' : 'Show position details'}
            className="flex-row items-center gap-2 active:opacity-70">
            <View className="flex-1 flex-row items-center gap-2.5">
              <Icon glyph={bet.emoji} size={19} color={theme.textSecondary} />
              <View className="flex-1">
                <ThemedText style={{ fontSize: 14, fontWeight: '700', color: theme.text }} numberOfLines={1}>{bet.category}</ThemedText>
                <ThemedText style={{ fontSize: 11, color: theme.textTertiary }} numberOfLines={1}>{bet.platform} · {riskLabel(bet.riskLevel)}</ThemedText>
              </View>
            </View>
            <StatusBadge status={bet.status} isLive={valuation?.pricing === 'live' || liveStatus?.isLive} />
            <ThemedText style={{ fontSize: 11, color: theme.textTertiary }}>{expanded ? '▲' : '▼'}</ThemedText>
          </Pressable>

          {expanded ? (
            <View
              style={{
                borderRadius: Radius.md,
                padding: 12,
                gap: 8,
                backgroundColor: theme.backgroundSelected,
                borderWidth: 1,
                borderColor: theme.border,
              }}>
              <View>
                <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.textTertiary, letterSpacing: 0.4 }}>WHAT THIS IS</ThemedText>
                <ThemedText style={{ fontSize: 13, color: theme.text, lineHeight: 19, marginTop: 2 }}>{bet.description}</ThemedText>
              </View>
              {bet.strategy ? (
                <View>
                  <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.textTertiary, letterSpacing: 0.4 }}>WHY</ThemedText>
                  <ThemedText style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 19, marginTop: 2 }}>{bet.strategy}</ThemedText>
                </View>
              ) : null}
              <ThemedText style={{ fontSize: 11, color: theme.textTertiary }}>
                Tracked {new Date(openedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </ThemedText>
            </View>
          ) : showDescription && (
            <ThemedText style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 19 }} numberOfLines={2}>{displayedDescription}</ThemedText>
          )}

          {bet.line ? (
            <View
              className="self-start px-2.5 py-1"
              style={{ borderRadius: Radius.sm, backgroundColor: theme.backgroundSelected }}>
              <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.text, ...MONO }}>{bet.line}</ThemedText>
            </View>
          ) : null}

          {showStockQuote && valuation && <StockQuotePanel valuation={valuation} />}

          {isActive && !isStock && liveStatus && <MonitorPanel liveStatus={liveStatus} goal={goal} />}

          <View className="flex-row items-baseline gap-1.5">
            <ThemedText style={{ fontSize: 18, fontWeight: '800', color: theme.text, ...MONO }}>{money(valuation?.costBasis ?? bet.amountWagered, { decimals: 0 })}</ThemedText>
            <ThemedText className="flex-1" style={{ fontSize: 12, color: theme.textTertiary }} numberOfLines={1}>
              {isStock ? 'cost basis' : 'invested'}
            </ThemedText>
            <ThemedText style={{ fontSize: 12, color: theme.textTertiary }}>target</ThemedText>
            <ThemedText style={{ fontSize: 13, fontWeight: '700', color: Semantic.positive, ...MONO }}>{money(targetProfitFor(bet), { decimals: 0, signed: true })}</ThemedText>
          </View>

          {isActive && !showSell && <ResolveButtons bet={bet} onResolve={onResolve} />}
          {bet.status === 'watching' && (
            <Pressable
              onPress={() => onResolve({ id: bet.id, status: 'active' })}
              className="items-center active:opacity-75"
              style={{ borderRadius: Radius.md, paddingVertical: 10, backgroundColor: Brand[500] + '20' }}>
              <ThemedText style={{ fontSize: 13, fontWeight: '700', color: Brand[500] }}>
                I invested after all
              </ThemedText>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

export const BetCard = memo(BetCardInner);

function StatusBadge({
  status,
  isLive,
}: {
  status: TrackedBet['status'];
  isLive?: boolean;
}): React.ReactElement {
  const map = {
    active: { color: isLive ? Semantic.positive : Semantic.caution, label: isLive ? 'Live' : 'Active' },
    won: { color: Semantic.positive, label: 'Won' },
    lost: { color: Semantic.negative, label: 'Lost' },
    watching: { color: Semantic.info, label: 'Watching' },
  };
  const { color, label } = map[status];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.pill, backgroundColor: color + '1A' }}>
      <View style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: color }} />
      <ThemedText style={{ fontSize: 11, fontWeight: '700', color }}>{label}</ThemedText>
    </View>
  );
}
