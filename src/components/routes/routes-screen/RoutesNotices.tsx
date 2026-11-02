import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, OnBrand, Radius, Semantic } from '@/constants/theme';
import { useSemanticText, useTheme } from '@/hooks/use-theme';
import type { GoalReach } from '@/lib/route-results';

/**
 * The verdict, when the answer is no.
 *
 * This is the state the product exists for. A goal that cannot be reached in the time
 * given is the one answer nobody else will give honestly, and before this existed the
 * screen fell through to the empty-filter card and rendered "No  routes" — the moment
 * the whole app is built around, shipping as a string-interpolation bug.
 *
 * It says the number, says how close the best route gets, and then offers only dials
 * the user actually owns: the amount, the filters, the goal itself. It never suggests
 * a riskier route as the way to close the gap.
 */
export function GoalUnreachable({ reach, when, investing, hasFilters, onRaiseInvestment, onClearFilters, onChangeGoal }: {
  reach: GoalReach;
  when: string;
  investing: number;
  hasFilters: boolean;
  onRaiseInvestment: (amount: number) => void;
  onClearFilters: () => void;
  onChangeGoal: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const semantic = useSemanticText();
  const percent = Math.round(reach.proximity * 100);
  const closest = Math.round(reach.bestProjectedReturn);
  const moreHelps = reach.investmentToReach != null && reach.investmentToReach > investing;

  return (
    <View
      style={{
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Semantic.caution + '4D',
        backgroundColor: Semantic.caution + '14',
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 10,
      }}>
      <ThemedText style={{ fontSize: 18, fontWeight: '700', color: theme.text, lineHeight: 25 }}>
        {`Nothing reaches +$${reach.target.toLocaleString()} ${when}.`}
      </ThemedText>
      <ThemedText style={{ fontSize: 14, lineHeight: 21, color: theme.textSecondary }}>
        {closest > 0
          ? `With $${investing.toLocaleString()} in, the best route makes about +$${closest.toLocaleString()}. That's ${percent}% of your goal.`
          : `With $${investing.toLocaleString()} in, no route makes any progress on it.`}
      </ThemedText>
      <ThemedText style={{ fontSize: 14, lineHeight: 21, color: theme.textSecondary }}>
        {moreHelps
          ? `To hit +$${reach.target.toLocaleString()}, you'd need to put in at least $${reach.investmentToReach!.toLocaleString()}.`
          : 'Putting in more wouldn\'t fix it. Try a smaller goal or a longer deadline.'}
      </ThemedText>
      <View className="flex-row flex-wrap" style={{ gap: 8, marginTop: 2 }}>
        {moreHelps ? (
          <Pressable
            onPress={() => onRaiseInvestment(reach.investmentToReach!)}
            accessibilityRole="button"
            accessibilityHint="Sets what you are willing to invest to that amount and re-ranks the list"
            className="active:opacity-85"
            style={{ borderRadius: Radius.md, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', backgroundColor: Brand[500] }}>
            <ThemedText style={{ fontSize: 14, fontWeight: '800', color: OnBrand }}>
              Invest up to ${reach.investmentToReach!.toLocaleString()}
            </ThemedText>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onChangeGoal}
          accessibilityRole="button"
          className="active:opacity-70"
          style={{ borderRadius: Radius.md, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: theme.borderControl }}>
          <ThemedText style={{ fontSize: 14, fontWeight: '800', color: theme.text }}>Change the goal</ThemedText>
        </Pressable>
        {hasFilters ? (
          <Pressable
            onPress={onClearFilters}
            accessibilityRole="button"
            accessibilityHint="Clears the filters. It will not bring a goal-reaching route back."
            className="active:opacity-70"
            style={{ paddingHorizontal: 8, minHeight: 44, justifyContent: 'center' }}>
            <ThemedText style={{ fontSize: 14, fontWeight: '700', color: semantic.brand }}>Clear filters</ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Shown when every route on screen is all-or-nothing and the reason is the budget rather
 * than the market.
 *
 * Without it the app reads as though contracts are all it deals in: the treasuries and
 * funds were priced out by `isRelevantRoute` and dropped in silence, so a user with $500
 * against a +$300 goal never learns that the safe options exist at all, let alone what
 * they cost. Naming the amount turns "this app only shows bets" into a number the user
 * can act on — and the button sets it, so the claim is testable in one tap.
 */
export function CapitalSafeNudge({ target, amount, onRaiseInvestment }: {
  target: number;
  amount: number;
  onRaiseInvestment: (amount: number) => void;
}): React.ReactElement {
  const theme = useTheme();

  return (
    <View
      style={{
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Brand[500] + '3D',
        backgroundColor: Brand[500] + '0F',
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 8,
      }}>
      <ThemedText style={{ fontSize: 13, fontWeight: '800', color: theme.text }}>
        Everything here is all-or-nothing
      </ThemedText>
      <ThemedText style={{ fontSize: 12.5, lineHeight: 18, color: theme.textSecondary }}>
        {`Routes that keep your capital — treasuries and funds — need more of it to reach `
          + `+$${target.toLocaleString()}. $${amount.toLocaleString()} is where the first one hits your goal.`}
      </ThemedText>
      <Pressable
        onPress={() => onRaiseInvestment(amount)}
        accessibilityRole="button"
        accessibilityHint="Sets what you are willing to invest to that amount and re-ranks the list"
        className="self-start justify-center active:opacity-85"
        style={{ borderRadius: Radius.md, paddingHorizontal: 16, minHeight: 44, backgroundColor: Brand[500] }}>
        <ThemedText style={{ fontSize: 14, fontWeight: '800', color: OnBrand }}>
          Invest up to ${amount.toLocaleString()}
        </ThemedText>
      </Pressable>
    </View>
  );
}
