import { useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDevReplayFunnel } from '@/api/hooks/useDevReplayFunnel';
import { useOnboardingProfile } from '@/api/hooks/useOnboardingProfile';
import { usePreferences } from '@/api/hooks/usePreferences';
import { useUserProfile, type UserProfileInput } from '@/api/hooks/useUserProfile';
import { OnboardingGlow } from '@/components/onboarding/OnboardingPreviews';
import { TaskRow, useTaskProgress } from '@/components/onboarding/quiz-kit';
import { buildTasks, SKIP, SOMETHING_ELSE } from '@/components/onboarding/quiz-pages';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deviceCountry } from '@/lib/device-region';
import { syncWeeklyReminder } from '@/lib/notifications';
import { ACQUISITION_PLATFORMS } from '@/lib/preferences';
import type { AcquisitionPlatform } from '@/types/bets';
import type { SurveyAnswers } from '@/lib/onboarding-profile';

/**
 * The screen is paced to a round ten seconds of visible work, and it is not
 * only theatre: the profile write to the server happens behind it.
 *
 * Rather than one linear sweep, each row fills on its own eased curve with a
 * beat of dead air after it — a bar that surges and then settles reads as a real
 * task completing, where a constant-rate bar reads as a timer.
 * 4 × 2000 fill + 3 × 400 gap + 800 tail = 10,000ms.
 */
const STAGE_FILL_MS = 2000;
const STAGE_GAP_MS = 400;
const TAIL_MS = 800;
const STAGE_COUNT = 4;

/** Paced so every card gets a turn inside the ten-second window. */
const FACT_ROTATE_MS = 3200;

/**
 * What rotates under the bars.
 *
 * Deliberately NOT testimonials or a user count. A quote or a rating rendered
 * here reads as a factual claim about Pathey, and inventing one is the exact
 * deceptive-endorsement problem the FTC endorsement guides and App Store
 * Review Guideline 2.3 exist for. These are statements about how the app works,
 * which are true by construction — swap them for real quotes only once there
 * are real quotes, with a real source named on each card.
 */
const FACTS = [
  {
    headline: 'Nothing is hidden from you',
    body: 'The live price, where it came from, what it costs, and what happens if it goes wrong.',
  },
  {
    headline: 'Safest first, always',
    body: 'The list starts with the sure things — savings and T-bills — and gets riskier from there. You choose how far down you go.',
  },
  {
    headline: 'You are never stuck',
    body: 'Ask our AI why any pick is where it is, and it will explain it in plain English.',
  },
];

/** Maps a completed quiz run onto the profile columns the server actually has. */
function toProfileInput(answers: SurveyAnswers): UserProfileInput {
  const outcome = answers.outcome === SOMETHING_ELSE ? answers.outcomeOther.trim() || SOMETHING_ELSE : answers.outcome;

  return {
    ageRange: answers.ageRange === SKIP ? null : answers.ageRange,
    // Read off the device rather than asked for — see @/lib/device-region.
    country: deviceCountry(),
    financialGoal: outcome,
    investingExperience: answers.experience,
    marketsInterested: answers.markets,
    // The multi-select "why are you here" collapses to one string for the
    // column; the full list stays in the local blob.
    signupReason: answers.motivations.join(', ') || null,
    investmentAmount: answers.amount === SKIP ? null : answers.amount,
  };
}

export default function BuildingPlanScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { profile, isLoading } = useOnboardingProfile();
  const { saveProfile } = useUserProfile();
  const { finishReplay } = useDevReplayFunnel();
  const { update: updatePreferences } = usePreferences();

  const answers = profile.answers;
  const tasks = useMemo(() => buildTasks(answers), [answers]);

  // Fired once. The bars are the cover for this write, not a substitute for it —
  // if it fails the funnel still moves on, and index.tsx will route the user
  // back through the survey rather than stranding them here.
  const saved = useRef(false);
  useEffect(() => {
    if (isLoading || saved.current) return;
    saved.current = true;
    saveProfile(toProfileInput(answers));

    // The answers that are real settings get written here rather than left as
    // quiz results nothing reads. Every search from now on is steered by these.
    updatePreferences({
      // "Any apps you would rather not use" is the same switch as the platform
      // list in Settings, so it writes straight to it.
      preferredPlatforms: ACQUISITION_PLATFORMS.map((platform) => platform.value).filter(
        (value) => !answers.avoidPlatforms.includes(value)
      ) as AcquisitionPlatform[],
      weeklyReminder: profile.notifications === 'enabled',
      // What they said to the notification ask governs the good-news pushes too.
      // The OS permission would block them anyway, but a Settings screen showing
      // "Position alerts: on" to someone who declined is a lie about the app.
      positionAlerts: profile.notifications === 'enabled',
    });
    void syncWeeklyReminder(profile.notifications === 'enabled').catch(() => {});
    // Reaching this screen means the funnel has been walked end to end, so a dev
    // replay is over and the router can go back to trusting the server.
    finishReplay();
  }, [answers, finishReplay, isLoading, profile.notifications, saveProfile, updatePreferences]);

  const done = useCallback(() => router.replace('/plan-ready' as Href), [router]);

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <OnboardingGlow />
      <SafeAreaView className="flex-1">
        {isLoading ? null : <BuildStages tasks={tasks} onDone={done} />}
      </SafeAreaView>
    </View>
  );
}

function BuildStages({ tasks, onDone }: { tasks: string[]; onDone: () => void }): React.ReactElement {
  const theme = useTheme();
  const progress = useTaskProgress({
    count: STAGE_COUNT,
    fillMs: STAGE_FILL_MS,
    gapMs: STAGE_GAP_MS,
    tailMs: TAIL_MS,
    onDone,
  });

  const [percent, setPercent] = useState(0);
  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      setPercent(Math.round((value / STAGE_COUNT) * 100));
    });
    return () => progress.removeListener(id);
  }, [progress]);

  const [factIndex, setFactIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFactIndex((current) => (current + 1) % FACTS.length), FACT_ROTATE_MS);
    return () => clearInterval(id);
  }, []);

  // Scrollable rather than a fixed column: four task rows plus the card below
  // them overflow a short phone, and on a screen with no buttons there was
  // nothing the user could do about it.
  return (
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 28, gap: 26 }}>
      <View style={{ gap: 8 }}>
        <ThemedText style={{ fontSize: 10, fontWeight: '900', letterSpacing: 1, color: Brand[500] }}>
          BUILDING YOUR PLAN
        </ThemedText>
        <View className="flex-row items-end" style={{ gap: 8 }}>
          <ThemedText
            style={{
              fontSize: 52,
              lineHeight: 58,
              fontWeight: '800',
              color: theme.text,
              letterSpacing: -1.6,
              fontVariant: ['tabular-nums'],
            }}>
            {percent}
          </ThemedText>
          <ThemedText style={{ fontSize: 20, fontWeight: '800', color: theme.textTertiary, marginBottom: 9 }}>
            %
          </ThemedText>
        </View>
      </View>

      <View style={{ gap: 18 }}>
        {tasks.map((task, index) => (
          <TaskRow key={task} label={task} progress={progress} index={index} />
        ))}
      </View>

      <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 28, minHeight: 120 }}>
        <FactCard fact={FACTS[factIndex]} />
      </View>
    </ScrollView>
  );
}

/** Cross-fades as the deck rotates, so the panel never blinks empty between cards. */
function FactCard({ fact }: { fact: (typeof FACTS)[number] }): React.ReactElement {
  const theme = useTheme();
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, fact]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        padding: 16,
        gap: 6,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.backgroundElement,
        ...Shadow.card,
      }}>
      <ThemedText style={{ fontSize: 14.5, fontWeight: '800', color: theme.text, letterSpacing: -0.3 }}>
        {fact.headline}
      </ThemedText>
      <ThemedText style={{ fontSize: 13, lineHeight: 18.5, color: theme.textSecondary }}>{fact.body}</ThemedText>
    </Animated.View>
  );
}
