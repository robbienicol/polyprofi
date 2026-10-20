import { useUser } from '@clerk/clerk-expo';
import { useRouter, type Href } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGoalsProgress } from '@/api/hooks/useGoalProgress';
import { usePortfolioProgress } from '@/api/hooks/usePortfolioProgress';
import { usePortfolioSeries } from '@/api/hooks/usePortfolioSeries';
import { useDefaultSearch } from '@/api/hooks/useDefaultSearch';
import { useQuizAnswers } from '@/api/hooks/useQuizAnswers';
import type { PortfolioProgressPoint } from '@/api/client/storage';
import { useSavedRoutes } from '@/api/hooks/useSavedRoutes';
import { useSavingsGoal } from '@/api/hooks/useSavingsGoal';
import { useTrackedBets } from '@/api/hooks/useTrackedBets';
import type { PortfolioRange } from '@/components/molecules/PortfolioLineChart';
import { GoalTrack } from '@/components/portfolio/HomeGoalTrack';
import { HomeValueCard } from '@/components/portfolio/HomeValueCard';
import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { Brand, OnBrand, Radius, Semantic, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { describeSearch } from '@/lib/quiz-profile';
import { cashFlowAdjustedChange } from '@/lib/portfolio-progress';
import { goalProgressFraction } from '@/lib/savings-goal';
import { withTabSkeleton } from '@/components/ui/with-tab-skeleton';
import { usePullRefresh } from '@/hooks/use-pull-refresh';

function HomeScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useUser();
  const { bets } = useTrackedBets();
  const { history } = useSavedRoutes();
  const { quizAnswers, saveAnswers } = useQuizAnswers();
  const { answers: defaultSearch } = useDefaultSearch();
  const [isStartingSearch, setIsStartingSearch] = useState(false);
  const latestSearch = history[0] ?? null;
  // The quiz prefills from exactly this, in exactly this order, so what the row
  // below shows is what the form will open on.
  const lastAnswers = quizAnswers ?? latestSearch?.quizSnapshot ?? null;
  const fallbackBalance = latestSearch?.quizSnapshot.balance ?? 0;
  const progress = usePortfolioProgress(fallbackBalance);
  const [range, setRange] = useState<PortfolioRange>('1D');
  // The point under the finger on the chart. While it is set the header reads
  // that moment instead of now — the whole point of scrubbing.
  const [scrubbed, setScrubbed] = useState<PortfolioProgressPoint | null>(null);

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
  const openGoals = goals
      .filter((goal) => !goal.achievedAt)
      .map((goal) => ({ goal, progress: goalsProgress.progressFor(goal.id) }))
      .sort((a, b) => (
        goalProgressFraction(b.progress.netGain, b.goal) - goalProgressFraction(a.progress.netGain, a.goal)
      ));
  const shownGoals = openGoals.slice(0, 3);

  const activeBets = bets.filter((bet) => bet.status === 'active');
  // Now, as the header shows it. The chart ends on exactly this point.
  const livePoint: PortfolioProgressPoint | null = (
    progress.activeCount > 0
      ? {
        time: progress.updatedAt?.getTime() ?? progress.observedAt,
        value: progress.value,
        basisValue: progress.basisValue,
        livePnl: progress.livePnl,
        projectedPnl: progress.projectedPnl,
      }
      : null
  );

  // Drawn from each holding's own price history, not from the moments the app was open.
  const { series } = usePortfolioSeries({
    bets: activeBets,
    range,
    live: livePoint,
    positionById: progress.positionById,
    recorded: progress.points,
  });

  const rangeStartPoint = series.baseline ?? {
    time: progress.observedAt,
    value: progress.basisValue,
    basisValue: progress.basisValue,
    livePnl: 0,
    projectedPnl: 0,
  };
  // The range as a whole, for the chart's colour. The header below follows the finger.
  const rangeRising = cashFlowAdjustedChange(rangeStartPoint, progress).amount >= 0;

  // Scrubbing compares the point under the finger with the start of the range,
  // so both numbers describe the same moment: "here is what it was worth, and
  // what it had made by then".
  const headPoint = scrubbed ?? progress;
  const adjustedChange = cashFlowAdjustedChange(rangeStartPoint, headPoint);
  const change = adjustedChange.amount;
  const changePct = adjustedChange.percent;
  const greeting = user?.firstName ? `Hey, ${user.firstName}` : 'Welcome back';

  const pull = usePullRefresh(progress.refresh);
  // Nothing priced yet and a refresh in flight: the first load, not a refresh.
  const firstLoad = progress.updatedAt == null && progress.isRefreshing;

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <SafeAreaView className="flex-1">
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={(
            <RefreshControl
              refreshing={pull.refreshing}
              onRefresh={pull.onRefresh}
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

          <HomeValueCard
            progress={progress}
            series={series}
            range={range}
            setRange={setRange}
            scrubbed={scrubbed}
            setScrubbed={setScrubbed}
            headValue={headPoint.value}
            change={change}
            changePct={changePct}
            rangeRising={rangeRising}
            firstLoad={firstLoad}
          />

          {/* One job on this screen: go make money. Straight to results on the last
              search, else on what onboarding said — the quiz is optional, one row down. */}
          <Pressable
            onPress={() => {
              if (!defaultSearch) {
                router.push('/quiz');
                return;
              }
              if (isStartingSearch) return;
              setIsStartingSearch(true);
              saveAnswers(defaultSearch, {
                onSuccess: () => router.push('/(tabs)/routes?generate=1' as Href),
                onSettled: () => setIsStartingSearch(false),
              });
            }}
            className="py-5 items-center active:opacity-85"
            style={{ borderRadius: Radius.xl, backgroundColor: Brand[500], ...Shadow.card }}>
            <ThemedText style={{ fontSize: 17, fontWeight: '900', color: OnBrand, letterSpacing: -0.2 }}>
              Find live routes →
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
              <Icon glyph="🔔" size={19} color={theme.textSecondary} />
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


export default withTabSkeleton(HomeScreen, 'home');

