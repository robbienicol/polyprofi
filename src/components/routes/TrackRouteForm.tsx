import { Platform, Pressable, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, OnBrand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Route } from '@/types/routes';

/** What a category cut can be set to. 100% is absent on purpose — see `CutForm`. */
export const CUT_PERCENT_OPTIONS = [10, 25, 50, 75] as const;

interface TrackRouteFormProps {
  amount: string;
  destinationLabel: string;
  onAmountChange: (amount: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  /**
   * Set for a "Cut spending" route, which asks a different question entirely: not how
   * much money to put in — none — but how much of the spending you will give up.
   */
  cut?: NonNullable<Route['spendingCut']>;
  cutPercent?: number;
  onCutPercentChange?: (percent: number) => void;
  /** Set for a "Card rewards" route: nothing to invest, only a plan to confirm. */
  cardRewards?: NonNullable<Route['cardRewards']>;
}

export function TrackRouteForm({
  amount,
  destinationLabel,
  onAmountChange,
  onConfirm,
  onCancel,
  cut,
  cutPercent = 25,
  onCutPercentChange,
  cardRewards,
}: TrackRouteFormProps): React.ReactElement {
  const theme = useTheme();
  const buttonPadding = Platform.select({ ios: 10, android: 6 }) ?? 10;

  if (cardRewards) {
    return (
      <CardRewardsForm
        plan={cardRewards}
        onConfirm={onConfirm}
        onCancel={onCancel}
        buttonPadding={buttonPadding}
      />
    );
  }

  if (cut) {
    return (
      <CutForm
        cut={cut}
        percent={cutPercent}
        onPercentChange={onCutPercentChange}
        destinationLabel={destinationLabel}
        onConfirm={onConfirm}
        onCancel={onCancel}
        buttonPadding={buttonPadding}
      />
    );
  }

  const canConfirm = Number(amount) > 0;
  return (
    <View className="gap-3" style={{ borderRadius: Radius.lg, padding: 14, backgroundColor: theme.backgroundElevated, borderWidth: 1, borderColor: theme.border }}>
      <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary, letterSpacing: 0.3 }}>HOW MUCH DO YOU PLAN ON INVESTING?</ThemedText>
      <View className="flex-row items-center gap-2">
        <View className="flex-1 flex-row items-center px-3 border" style={{ borderRadius: Radius.md, borderColor: theme.borderStrong, paddingVertical: buttonPadding, backgroundColor: theme.background }}>
          <ThemedText style={{ color: theme.textTertiary, fontSize: 16 }}>$</ThemedText>
          <TextInput value={amount} onChangeText={onAmountChange} keyboardType="numeric" placeholder="0" placeholderTextColor={theme.textTertiary} className="flex-1" style={{ color: theme.text, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] }} autoFocus />
        </View>
        <Pressable disabled={!canConfirm} onPress={onConfirm} className="px-4 active:opacity-80" style={{ borderRadius: Radius.md, backgroundColor: Brand[500], paddingVertical: buttonPadding, opacity: canConfirm ? 1 : 0.4 }}>
          <ThemedText style={{ fontSize: 14, fontWeight: '800', color: OnBrand }}>Open {destinationLabel}</ThemedText>
        </Pressable>
        <Pressable onPress={onCancel} className="px-3 border active:opacity-70" style={{ borderRadius: Radius.md, borderColor: theme.border, paddingVertical: buttonPadding }}>
          <ThemedText type="small" themeColor="textSecondary">Cancel</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * A cut commits no money, so there is no amount to type. A subscription is all or
 * nothing and only needs confirming; a category is a question of how much.
 *
 * The choices stop at 75%. A 100% category cut means never filling the tank or eating
 * out again before the deadline — nobody holds that, and offering it would put a
 * number on the card the app already knows will not happen.
 */
function CutForm({
  cut,
  percent,
  onPercentChange,
  destinationLabel,
  onConfirm,
  onCancel,
  buttonPadding,
}: {
  cut: NonNullable<Route['spendingCut']>;
  percent: number;
  onPercentChange?: (percent: number) => void;
  destinationLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  buttonPadding: number;
}): React.ReactElement {
  const theme = useTheme();
  const subscription = cut.kind === 'subscription';
  const monthly = subscription ? cut.monthlyAmount : (cut.monthlyAmount * percent) / 100;

  return (
    <View className="gap-3" style={{ borderRadius: Radius.lg, padding: 14, backgroundColor: theme.backgroundElevated, borderWidth: 1, borderColor: theme.border }}>
      <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary, letterSpacing: 0.3 }}>
        {subscription
          ? `CANCELLING ${cut.merchant.toUpperCase()}`
          : `HOW MUCH LESS WILL YOU SPEND ON ${cut.merchant.toUpperCase()}?`}
      </ThemedText>

      {!subscription ? (
        <View className="flex-row" style={{ gap: 8 }}>
          {CUT_PERCENT_OPTIONS.map((option) => {
            const active = option === percent;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => onPercentChange?.(option)}
                className="flex-1 items-center active:opacity-80"
                style={{
                  borderRadius: Radius.md,
                  paddingVertical: 10,
                  borderWidth: 1,
                  borderColor: active ? Brand[500] : theme.border,
                  backgroundColor: active ? Brand[500] + '1A' : theme.background,
                }}>
                <ThemedText style={{ fontSize: 14, fontWeight: active ? '800' : '600', color: active ? Brand[500] : theme.textSecondary }}>
                  {option}%
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <ThemedText type="small" themeColor="textSecondary">
        {subscription
          ? `$${cut.monthlyAmount.toFixed(2)} a month back, every month, once it is cancelled.`
          : `$${monthly.toFixed(0)} a month back, out of the $${cut.monthlyAmount.toFixed(0)} you average.`}
      </ThemedText>

      <View className="flex-row items-center" style={{ gap: 8 }}>
        <Pressable
          onPress={onConfirm}
          className="flex-1 items-center active:opacity-80"
          style={{ borderRadius: Radius.md, backgroundColor: Brand[500], paddingVertical: buttonPadding }}>
          <ThemedText style={{ fontSize: 14, fontWeight: '800', color: OnBrand }}>
            {subscription ? destinationLabel : 'Add to my plan'}
          </ThemedText>
        </Pressable>
        <Pressable onPress={onCancel} className="px-3 border active:opacity-70" style={{ borderRadius: Radius.md, borderColor: theme.border, paddingVertical: buttonPadding }}>
          <ThemedText type="small" themeColor="textSecondary">Cancel</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * A card-rewards plan commits no money either. Re-routing is a decision about which
 * card comes out at the register; a new card is an application, and the form says
 * what that costs before it opens one.
 */
function CardRewardsForm({
  plan,
  onConfirm,
  onCancel,
  buttonPadding,
}: {
  plan: NonNullable<Route['cardRewards']>;
  onConfirm: () => void;
  onCancel: () => void;
  buttonPadding: number;
}): React.ReactElement {
  const theme = useTheme();
  const newCard = plan.kind === 'new-card';
  return (
    <View className="gap-3" style={{ borderRadius: Radius.lg, padding: 14, backgroundColor: theme.backgroundElevated, borderWidth: 1, borderColor: theme.border }}>
      <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary, letterSpacing: 0.3 }}>
        {newCard ? `APPLYING FOR THE ${(plan.cardName ?? 'card').toUpperCase()}` : 'USING THE RIGHT CARD'}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {newCard
          ? 'Approval isn\'t guaranteed and applying is a hard credit inquiry. Put only spending you already do on it, and pay it in full every month.'
          : 'Nothing to open or sign up for. Switch the card for these categories, and update it anywhere that bills you automatically.'}
      </ThemedText>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <Pressable
          onPress={onConfirm}
          className="flex-1 items-center active:opacity-80"
          style={{ borderRadius: Radius.md, backgroundColor: Brand[500], paddingVertical: buttonPadding }}>
          <ThemedText style={{ fontSize: 14, fontWeight: '800', color: OnBrand }}>
            {newCard && plan.applyUrl ? 'Add to my plan & apply' : 'Add to my plan'}
          </ThemedText>
        </Pressable>
        <Pressable onPress={onCancel} className="px-3 border active:opacity-70" style={{ borderRadius: Radius.md, borderColor: theme.border, paddingVertical: buttonPadding }}>
          <ThemedText type="small" themeColor="textSecondary">Cancel</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}
