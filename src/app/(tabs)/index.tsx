import { useUser } from '@clerk/clerk-expo';
import { useRouter, type Href } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGoalsProgress, type GoalProgress } from '@/api/hooks/useGoalProgress';
import { usePortfolioProgress } from '@/api/hooks/usePortfolioProgress';
import { useMoney, usePreferences } from '@/api/hooks/usePreferences';
import { useQuizAnswers } from '@/api/hooks/useQuizAnswers';
import { useSavedRoutes } from '@/api/hooks/useSavedRoutes';
import { useSavingsGoal } from '@/api/hooks/useSavingsGoal';
import { useTrackedBets } from '@/api/hooks/useTrackedBets';
import {
  PortfolioLineChart,
  PortfolioRange,
} from '@/components/molecules/PortfolioLineChart';
import { ThemedText } from '@/components/themed-text';
import { Brand, OnBrand, Radius, Semantic, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { maturityWords, portfolioStats } from '@/lib/portfolio';
import { describeSearch } from '@/lib/quiz-profile';
import { cashFlowAdjustedChange } from '@/lib/portfolio-progress';
import { goalProgressFraction, goalRemaining, isOpenEnded } from '@/lib/savings-goal';
import type { SavingsGoal } from '@/types/bets';

const MONO = { fontVariant: ['tabular-nums' as const] };

const RANGE_MS: Record<Exclude<PortfolioRange, 'ALL'>, number> = {
  '1D': 24 * 60 * 60 * 1_000,
  '1W': 7 * 24 * 60 * 60 * 1_000,
  '1M': 30 * 24 * 60 * 60 * 1_000,
};

function relativeUpdate(date: Date | null): string {
  if (!date) return 'Waiting for first refresh';
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1_000));
  if (seconds < 15) return 'Updated just now';
  if (seconds < 60) return `Updated ${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `Updated ${minutes}m ago`;
}

export default function HomeScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useUser();
  const money = useMoney();
  const { preferences } = usePreferences();
  const { bets } = useTrackedBets();
  const { history } = useSavedRoutes();
  const { quizAnswers } = useQuizAnswers();
  const latestSearch = history[0] ?? null;
  // The quiz prefills from exactly this, in exactly this order, so what the row
  // below shows is what the form will open on.
  const lastAnswers = quizAnswers ?? latestSearch?.quizSnapshot ?? null;
  const fallbackBalance = latestSearch?.quizSnapshot.balance ?? 0;
  const progress = usePortfolioProgress(fallbackBalance);
  const [range, setRange] = useState<PortfolioRange>('1W');

  // Home used to be live money only, with the goals a tab away. But the whole
  // proposition is "here is the goal, here is the route to it", and the first screen
  // never said how far off the goal was — the distance to the destination was the one
  // number missing from it. The rollup below is that distance, not a second Goals tab:
  // the goals still nearest to done, and nothing to act on beyond opening one.
  // Marking a goal reached still happens in useGoalMaintenance, mounted at the root,
  // so it doesn't depend on which screen is open.
  const { goals } = useSavingsGoal();
  const goalsProgress = useGoalsProgress(goals);
  // Reached goals drop off: this asks what is left to earn, and a finished goal has
  // nothing. Closest to done first, so the one worth another route is at the top;
  // open-ended goals have no fraction and sort last on their own.
  const openGoals = useMemo(
    () => goals
      .filter((goal) => !goal.achievedAt)
      .map((goal) => ({ goal, progress: goalsProgress.progressFor(goal.id) }))
      .sort((a, b) => (
        goalProgressFraction(b.progress.netGain, b.goal) - goalProgressFraction(a.progress.netGain, a.goal)
      )),
    [goals, goalsProgress],
  );
  const shownGoals = openGoals.slice(0, 3);

  // Expected value is a probability-weighted average over outcomes, not a price,
  // so it is labelled and kept out of the headline: adding it to tracked value
  // would make a modelled number read as money already in the account.
  const activeBets = useMemo(() => bets.filter((bet) => bet.status === 'active'), [bets]);
  const stats = useMemo(
    () => portfolioStats(bets, preferences.conservativeProjections),
    [bets, preferences.conservativeProjections]
  );
  const expectedHorizon = useMemo(
    () => activeBets.reduce((longest, bet) => Math.max(longest, bet.maturesInDays ?? 0), 0),
    [activeBets]
  );

  const chartPoints = useMemo(() => {
    const current = {
      time: progress.updatedAt?.getTime() ?? progress.observedAt,
      value: progress.value,
      basisValue: progress.basisValue,
      livePnl: progress.livePnl,
      projectedPnl: progress.projectedPnl,
    };
    if (progress.points.length === 0) {
      return progress.basisValue > 0
        ? [{ ...current, time: current.time - 60_000 }, current]
        : [];
    }
    const last = progress.points[progress.points.length - 1];
    return last.time === current.time && Math.abs(last.value - current.value) < 0.005
      ? progress.points
      : [...progress.points, current];
  }, [progress.basisValue, progress.livePnl, progress.observedAt, progress.points, progress.projectedPnl, progress.updatedAt, progress.value]);

  const rangeStartPoint = useMemo(() => {
    if (chartPoints.length === 0) {
      return {
        time: progress.observedAt,
        value: progress.basisValue,
        basisValue: progress.basisValue,
        livePnl: 0,
        projectedPnl: 0,
      };
    }
    if (range === 'ALL') return chartPoints[0];
    const cutoff = chartPoints[chartPoints.length - 1].time - RANGE_MS[range];
    const first = chartPoints.find((point) => point.time >= cutoff);
    return first ?? chartPoints[0];
  }, [chartPoints, progress.basisValue, progress.observedAt, range]);

  const adjustedChange = cashFlowAdjustedChange(rangeStartPoint, progress);
  const change = adjustedChange.amount;
  const changePct = adjustedChange.percent;
  const positive = change >= 0;
  const changeColor = positive ? Semantic.positive : Semantic.negative;
  const greeting = user?.firstName ? `Hey, ${user.firstName}` : 'Welcome back';

  const trackingLabel = progress.livePositions > 0 && progress.projectedPositions > 0
    ? `${progress.livePositions} live · ${progress.projectedPositions} projected`
    : progress.livePositions > 0
      ? `${progress.livePositions} live market${progress.livePositions === 1 ? '' : 's'}`
      : progress.projectedPositions > 0
        ? `${progress.projectedPositions} projected position${progress.projectedPositions === 1 ? '' : 's'}`
        : progress.activeCount > 0
          ? `${progress.activeCount} position${progress.activeCount === 1 ? '' : 's'} tracked`
          : 'No positions yet';

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <SafeAreaView className="flex-1">
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={(
            <RefreshControl
              refreshing={progress.isRefreshing}
              onRefresh={progress.refresh}
              tintColor={Brand[500]}
            />
          )}
          contentContainerClassName="px-4 pt-4 pb-16 gap-5">

          <View style={{ paddingHorizontal: 2 }}>
            <ThemedText style={{ fontSize: 11, fontWeight: '900', color: Brand[500], letterSpacing: 1.1 }}>
              PATHEY
            </ThemedText>
            <ThemedText style={{ fontSize: 18, fontWeight: '700', color: theme.text, marginTop: 3 }}>
              {greeting}
            </ThemedText>
          </View>

          <View
            style={{
              borderRadius: Radius.xl,
              backgroundColor: theme.backgroundElevated,
              borderWidth: 1,
              borderColor: theme.border,
              paddingHorizontal: 18,
              paddingTop: 18,
              paddingBottom: 14,
              ...Shadow.card,
            }}>
            <View className="flex-row items-center justify-between">
              <ThemedText style={{ fontSize: 12, fontWeight: '800', color: theme.textTertiary, letterSpacing: 0.35 }}>
                TRACKED VALUE · LIVE
              </ThemedText>
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <View style={{
                  width: 7,
                  height: 7,
                  borderRadius: Radius.pill,
                  backgroundColor: progress.livePositions > 0 ? Semantic.positive : progress.projectedPositions > 0 ? Semantic.caution : theme.textTertiary,
                }} />
                <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary }}>
                  {trackingLabel}
                </ThemedText>
              </View>
            </View>

            <ThemedText
              style={{
                fontSize: 40,
                lineHeight: 48,
                fontWeight: '800',
                color: theme.text,
                letterSpacing: -1.4,
                marginTop: 9,
                ...MONO,
              }}>
              {money(progress.value)}
            </ThemedText>
            <View className="flex-row items-center" style={{ gap: 7, marginTop: 2 }}>
              <ThemedText style={{ fontSize: 14, fontWeight: '800', color: changeColor, ...MONO }}>
                {money(change, { signed: true })} ({positive ? '+' : '−'}{Math.abs(changePct).toFixed(2)}%)
              </ThemedText>
              <ThemedText style={{ fontSize: 12, color: theme.textTertiary }}>{range}</ThemedText>
            </View>

            <View style={{ marginHorizontal: -3, marginTop: 7 }}>
              <PortfolioLineChart
                points={chartPoints}
                range={range}
                onRangeChange={setRange}
                projected={progress.projectedPositions > 0}
              />
            </View>

            {activeBets.length > 0 ? (
              <View
                className="flex-row items-end justify-between"
                style={{ borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12, marginTop: 4, gap: 12 }}>
                <View className="flex-1">
                  <ThemedText style={{ fontSize: 11, fontWeight: '800', color: theme.textTertiary, letterSpacing: 0.35 }}>
                    EXPECTED VALUE
                  </ThemedText>
                  <ThemedText style={{ fontSize: 11, lineHeight: 15, color: theme.textTertiary, marginTop: 2 }}>
                    {expectedHorizon > 0
                      ? `Average across every outcome over ${maturityWords(expectedHorizon)}. Modelled — no money has moved.`
                      : 'Average across every outcome. Modelled — no money has moved.'}
                  </ThemedText>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {/* Neutral, never green or red: this is a model average, so colouring
                      it would read as money made or lost. */}
                  <ThemedText style={{ fontSize: 15, fontWeight: '800', color: theme.text, letterSpacing: -0.3, ...MONO }}>
                    {money(stats.totalEv, { signed: true })}
                  </ThemedText>
                  <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, marginTop: 1, ...MONO }}>
                    {stats.weightedReturnPct >= 0 ? '+' : '−'}{Math.abs(stats.weightedReturnPct).toFixed(1)}% on {money(stats.totalStaked, { decimals: 0 })}
                  </ThemedText>
                </View>
              </View>
            ) : null}

            <View
              className="flex-row items-center justify-between"
              style={{ borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12, marginTop: 4 }}>
              <ThemedText style={{ fontSize: 11, color: theme.textTertiary }}>
                {progress.isRefreshing ? 'Refreshing market prices…' : relativeUpdate(progress.updatedAt)}
              </ThemedText>
              {progress.projectedPositions > 0 ? (
                <View className="flex-row items-center" style={{ gap: 5 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 9, borderWidth: 1, borderColor: Semantic.caution }} />
                  <ThemedText style={{ fontSize: 11, color: Semantic.caution }}>includes projected accrual</ThemedText>
                </View>
              ) : null}
            </View>
          </View>

          {/* Distance to the goals still running. Hidden with no open goals — the button
              below is the whole answer then, and an empty rail would only be furniture. */}
          {shownGoals.length > 0 ? (
            <View style={{ gap: 10 }}>
              <View className="flex-row items-center justify-between" style={{ paddingHorizontal: 2 }}>
                <ThemedText style={{ fontSize: 11, fontWeight: '800', color: theme.textTertiary, letterSpacing: 0.35 }}>
                  STILL TO GO
                </ThemedText>
                {openGoals.length > shownGoals.length ? (
                  <Pressable onPress={() => router.push('/(tabs)/goals')} hitSlop={8} className="active:opacity-60">
                    <ThemedText style={{ fontSize: 12, fontWeight: '800', color: Brand[500] }}>
                      All {openGoals.length} goals →
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
              {shownGoals.map(({ goal, progress: goalProgress }) => (
                <GoalTrack
                  key={goal.id}
                  goal={goal}
                  progress={goalProgress}
                  onPress={() => router.push(`/goal/${goal.id}` as Href)}
                />
              ))}
            </View>
          ) : null}

          {/* One job on this screen: go make money. The quiz is where the goal gets
              picked, so this always starts there rather than re-running a stale search. */}
          <Pressable
            onPress={() => router.push('/quiz')}
            className="py-5 items-center active:opacity-85"
            style={{ borderRadius: Radius.xl, backgroundColor: Brand[500], ...Shadow.card }}>
            <ThemedText style={{ fontSize: 17, fontWeight: '900', color: OnBrand, letterSpacing: -0.2 }}>
              Find routes →
            </ThemedText>
            <ThemedText style={{ fontSize: 11, fontWeight: '700', color: OnBrand, opacity: 0.7, marginTop: 3 }}>
              Ranked routes from live markets, in under a minute
            </ThemedText>
          </Pressable>

          {/* The quiz already reopens on the last answers; nothing on this screen said
              so, so the only way back into them looked like starting over. */}
          {lastAnswers ? (
            <Pressable
              onPress={() => router.push('/quiz')}
              accessibilityRole="button"
              accessibilityLabel="Edit your last search"
              className="flex-row items-center active:opacity-80"
              style={{
                borderRadius: Radius.lg,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.backgroundElevated,
                paddingHorizontal: 16,
                paddingVertical: 13,
                gap: 12,
                marginTop: -10,
              }}>
              <View className="flex-1">
                <ThemedText style={{ fontSize: 11, fontWeight: '800', color: theme.textTertiary, letterSpacing: 0.35 }}>
                  YOUR LAST SEARCH
                </ThemedText>
                <ThemedText style={{ fontSize: 13, fontWeight: '700', color: theme.text, marginTop: 2 }} numberOfLines={1}>
                  {describeSearch(lastAnswers)}
                </ThemedText>
              </View>
              <ThemedText style={{ fontSize: 13, fontWeight: '800', color: Brand[500] }}>
                Edit →
              </ThemedText>
            </Pressable>
          ) : null}

          {/* Only surfaced when a position actually needs a decision. */}
          {progress.sellAlerts.length > 0 ? (
            <Pressable
              onPress={() => router.push('/positions')}
              accessibilityRole="button"
              className="flex-row items-center active:opacity-80"
              style={{
                borderRadius: Radius.lg,
                borderWidth: 1,
                borderColor: Semantic.caution + '66',
                backgroundColor: Semantic.caution + '14',
                paddingHorizontal: 16,
                paddingVertical: 14,
                gap: 12,
              }}>
              <ThemedText style={{ fontSize: 20 }}>🔔</ThemedText>
              <View className="flex-1">
                <ThemedText style={{ fontSize: 14, fontWeight: '800', color: theme.text }}>
                  {progress.sellAlerts.length} position{progress.sellAlerts.length === 1 ? '' : 's'} worth a look
                </ThemedText>
                <ThemedText style={{ fontSize: 11, color: theme.textSecondary, marginTop: 1 }} numberOfLines={1}>
                  {progress.sellAlerts[0].reason}
                </ThemedText>
              </View>
              <ThemedText style={{ fontSize: 18, color: Semantic.caution }}>→</ThemedText>
            </Pressable>
          ) : null}

          <ThemedText style={{ fontSize: 11, lineHeight: 16, color: theme.textTertiary, textAlign: 'center', paddingHorizontal: 14 }}>
            Polymarket and supported stocks use refreshed market prices. Savings and Treasury movement is estimated from tracked yield and time to maturity.
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" className="text-center" style={{ opacity: 0.38 }}>
            AI-generated · Not financial advice · Informational only
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/**
 * One goal, reduced to the only thing Home has to say about it: how far it still is.
 * The Goals tab carries the full card — staked, positions, the tick box — so repeating
 * any of that here would make two screens compete to be the place goals are managed.
 */
function GoalTrack({
  goal,
  progress,
  onPress,
}: {
  goal: SavingsGoal;
  progress: GoalProgress;
  onPress: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const money = useMoney();
  const openEnded = isOpenEnded(goal);
  const fraction = goalProgressFraction(progress.netGain, goal);
  const remaining = goalRemaining(progress.netGain, goal);
  const pct = Math.round(fraction * 100);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        openEnded
          ? `${goal.label}, open-ended, ${money(progress.netGain, { decimals: 0, signed: true })} in net gains`
          : `${goal.label}, ${pct} percent there, ${money(remaining, { decimals: 0 })} to go`
      }
      className="active:opacity-80"
      style={{
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.backgroundElevated,
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 9,
      }}>
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <ThemedText style={{ fontSize: 18 }}>{goal.emoji}</ThemedText>
        <ThemedText
          style={{ flex: 1, fontSize: 14, fontWeight: '700', color: theme.text, letterSpacing: -0.2 }}
          numberOfLines={1}>
          {goal.label}
        </ThemedText>
        {/* An open-ended goal has no finish line to be a fraction of, so it reports what
            it has earned instead of a percentage it can never complete. */}
        <ThemedText style={{ fontSize: 13, fontWeight: '800', color: theme.text, ...MONO }}>
          {openEnded
            ? money(progress.netGain, { decimals: 0, signed: true })
            : `${money(remaining, { decimals: 0 })} to go`}
        </ThemedText>
      </View>

      {openEnded ? null : (
        <View className="flex-row items-center" style={{ gap: 9 }}>
          <View
            className="flex-1"
            style={{ height: 6, borderRadius: Radius.pill, backgroundColor: theme.backgroundSelected, overflow: 'hidden' }}>
            {/* Empty stays empty. A minimum-width sliver would draw progress that has
                not happened, which is exactly the number this screen must not invent. */}
            {fraction > 0 ? (
              <View
                style={{
                  width: `${Math.max(fraction * 100, 2)}%`,
                  height: '100%',
                  borderRadius: Radius.pill,
                  backgroundColor: Brand[500],
                }}
              />
            ) : null}
          </View>
          <ThemedText style={{ fontSize: 11, fontWeight: '800', color: theme.textSecondary, ...MONO }}>
            {pct}%
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}
