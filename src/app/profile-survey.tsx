import { useRouter, type Href } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useOnboardingProfile } from '@/api/hooks/useOnboardingProfile';
import { useRoutePrefetch } from '@/api/hooks/useRoutePrefetch';
import { OnboardingGlow } from '@/components/onboarding/OnboardingPreviews';
import { PageHead, useSpokenLine } from '@/components/onboarding/quiz-kit';
import { buildPageCopy, CAN_CONTINUE, isPageVisible, PAGE_IDS } from '@/components/onboarding/quiz-pages';
import { renderPageBody } from '@/components/onboarding/survey/SurveyPageBody';
import { ThemedText } from '@/components/themed-text';
import { Brand, OnBrand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { EMPTY_ANSWERS, type NotificationChoice, type SurveyAnswers } from '@/lib/onboarding-profile';
import { requestNotificationPermission } from '@/lib/notifications';

/** How long the slide across to the next page takes. */
const SLIDE_MS = 420;
/** Pages this far from the current one are mounted; the rest stay unrendered. */
const RENDER_WINDOW = 1;

export default function ProfileSurveyScreen(): React.ReactElement {
  const { profile, name, isLoading, patchProfileAsync } = useOnboardingProfile();

  // The quiz is a single form with its own state; remount it once the stored
  // answers are actually available so a resumed run starts from them.
  if (isLoading) return <View className="flex-1" />;

  return <SurveyForm initial={profile.answers} name={name} patchProfileAsync={patchProfileAsync} />;
}

function SurveyForm({
  initial,
  name,
  patchProfileAsync,
}: {
  initial: SurveyAnswers;
  name: string;
  patchProfileAsync: ReturnType<typeof useOnboardingProfile>['patchProfileAsync'];
}): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const compact = height > 0 && height < 740;

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<SurveyAnswers>({ ...EMPTY_ANSWERS, ...initial });
  const [notifications, setNotifications] = useState<NotificationChoice>(null);
  const [askingPermission, setAskingPermission] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pageId = PAGE_IDS[index];

  // Start warming market data once the first two answers are in. Early enough to
  // buy the search most of a minute, late enough that someone who bounces off the
  // first question never triggers it.
  useRoutePrefetch(index >= PAGE_IDS.indexOf('capital'));
  const copy = buildPageCopy(answers, name);
  // One clock for the page's read-back line. Keyed on the page rather than the
  // text, which is rebuilt on every tap.
  const speech = useSpokenLine(copy[pageId].ack, pageId);

  /* -------------------------------------------------------------- movement */

  const [track] = useState(() => new Animated.Value(0));
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(track, {
      toValue: index,
      duration: SLIDE_MS,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
      useNativeDriver: true,
    }).start();
    Animated.timing(progress, {
      toValue: (index + 1) / PAGE_IDS.length,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [index, track, progress]);

  // Skips past any page whose PAGE_VISIBLE predicate says it doesn't apply —
  // bank_connect chief among them, reachable only by toggling "Cut spending"
  // on the markets page just before it.
  const advance = () => {
    let next = index + 1;
    while (next < PAGE_IDS.length - 1 && !isPageVisible(PAGE_IDS[next], answers)) next++;
    setIndex(Math.min(PAGE_IDS.length - 1, next));
  };

  const back = () => {
    // A retake opened from Settings can be backed out of from its first page.
    if (index === 0) {
      if (router.canGoBack()) router.back();
      return;
    }
    let prev = index - 1;
    while (prev > 0 && !isPageVisible(PAGE_IDS[prev], answers)) prev--;
    setIndex(Math.max(0, prev));
  };

  const nearby = (target: number) => Math.abs(target - index) <= RENDER_WINDOW;

  /* --------------------------------------------------------------- answers */

  const set = <K extends keyof SurveyAnswers>(key: K, value: SurveyAnswers[K]) => {
    setAnswers((current) => ({ ...current, [key]: value }));
  };

  /** Multi-select toggle for either of the two string-list answers still asked. */
  const toggleIn = (key: 'markets' | 'avoidPlatforms', value: string) => {
    setAnswers((current) => {
      const list = current[key];
      const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
      return { ...current, [key]: next };
    });
  };

  /* ----------------------------------------------------------- permissions */

  const enableNotifications = async () => {
    if (askingPermission) return;
    setAskingPermission(true);
    // The OS sheet is modal and sits there until it is answered — nothing may
    // move until it comes back, or the page slides out from under the prompt.
    const granted = await requestNotificationPermission().catch(() => false);
    setAskingPermission(false);
    setNotifications(granted ? 'enabled' : 'skipped');
    advance();
  };

  const skipNotifications = () => {
    setNotifications('skipped');
    advance();
  };

  /* --------------------------------------------------------------- finish */

  const finish = () => {
    if (submitting) return;
    setSubmitting(true);
    // The answers are handed to the build screen rather than saved here: that
    // screen performs the server write behind its own progress bars, so the
    // work is covered by something worth watching.
    void patchProfileAsync({ answers, notifications })
      .then(() => router.replace('/building-plan' as Href))
      .catch(() => setSubmitting(false));
  };

  /* ----------------------------------------------------------------- chrome */

  const unlocked = CAN_CONTINUE[pageId](answers);
  const isLast = index === PAGE_IDS.length - 1;
  // Both loaders drive themselves; the notification page has its own two buttons.
  const hidesFooter = pageId === 'scan' || pageId === 'notifications';

  const pageStyle = {
    width,
    paddingHorizontal: 24,
    paddingTop: compact ? 10 : 16,
  } as const;

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <OnboardingGlow />
      <SafeAreaView className="flex-1">
        {/* One bar for the whole run. A literal count just tells someone how
            many questions are still ahead of them. */}
        <View className="px-6 pt-2" style={{ gap: 8 }}>
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <Pressable
              onPress={back}
              disabled={index === 0 && !router.canGoBack()}
              accessibilityRole="button"
              accessibilityLabel="Back"
              className="active:opacity-60"
              style={{ opacity: index === 0 && !router.canGoBack() ? 0 : 1, paddingVertical: 4, paddingRight: 4 }}>
              <ThemedText style={{ fontSize: 15, fontWeight: '700', color: theme.textSecondary }}>←</ThemedText>
            </Pressable>
            <View
              className="flex-1 overflow-hidden"
              style={{ height: 4, borderRadius: Radius.pill, backgroundColor: theme.backgroundSelected }}>
              <Animated.View
                style={{
                  height: '100%',
                  borderRadius: Radius.pill,
                  backgroundColor: Brand[500],
                  width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                }}
              />
            </View>
          </View>
        </View>

        {/* Every page sits side by side on one long track, so advancing carries
            the track sideways rather than cross-fading through an empty frame. */}
        <View className="flex-1 overflow-hidden">
          <Animated.View
            style={{
              flex: 1,
              flexDirection: 'row',
              width: width * PAGE_IDS.length,
              transform: [
                { translateX: track.interpolate({ inputRange: [0, 1], outputRange: [0, -width] }) },
              ],
            }}>
            {PAGE_IDS.map((id, pageIndex) => (
              <View key={id} style={pageStyle}>
                {nearby(pageIndex) ? (
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ flexGrow: 1, paddingBottom: 16, gap: compact ? 14 : 18 }}>
                    <PageHead copy={copy[id]} speech={speech} compact={compact} />
                    {renderPageBody({
                      id,
                      answers,
                      compact,
                      active: pageIndex === index,
                      askingPermission,
                      set,
                      toggleIn,
                      onScanDone: advance,
                      // Connecting is one card among four now, not a whole page — it
                      // marks itself done and the run stays put, same as ticking a
                      // platform on or off.
                      onBankConnected: () => set('bankConnected', true),
                      onEnableNotifications: enableNotifications,
                      onSkipNotifications: skipNotifications,
                      onJumpTo: setIndex,
                    })}
                  </ScrollView>
                ) : null}
              </View>
            ))}
          </Animated.View>
        </View>

        {!hidesFooter ? (
          <View className="px-6 pb-3 pt-2">
            <Pressable
              onPress={isLast ? finish : advance}
              disabled={!unlocked || submitting}
              accessibilityRole="button"
              accessibilityState={{ disabled: !unlocked || submitting }}
              className="py-4 items-center active:opacity-85"
              style={{
                borderRadius: Radius.lg,
                backgroundColor: Brand[500],
                opacity: unlocked && !submitting ? 1 : 0.4,
                ...Shadow.card,
              }}>
              <ThemedText style={{ fontSize: 16, fontWeight: '800', color: OnBrand, letterSpacing: -0.2 }}>
                {submitting ? 'Building…' : isLast ? 'Build my plan →' : 'Continue'}
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <View style={{ height: 8 }} />
        )}
      </SafeAreaView>
    </View>
  );
}
