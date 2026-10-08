import { useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, Linking, Modal, Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBankConnect } from '@/api/hooks/useBankConnect';
import { useOnboardingProfile } from '@/api/hooks/useOnboardingProfile';
import { useRoutePrefetch } from '@/api/hooks/useRoutePrefetch';
import { OnboardingGlow } from '@/components/onboarding/OnboardingPreviews';
import { Choice, Options, PageHead, TaskRow, useSpokenLine, useTaskProgress } from '@/components/onboarding/quiz-kit';
import {
  AMOUNTS,
  buildPageCopy,
  CAN_CONTINUE,
  isPageVisible,
  MARKETS,
  OUTCOMES,
  PAGE_IDS,
  SCAN_TASK_COUNT,
  scanTasks,
  SKIP,
  SOMETHING_ELSE,
  type PageId,
} from '@/components/onboarding/quiz-pages';
import { BrandMark } from '@/components/ui/BrandMark';
import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { Brand, OnBrand, Radius, Semantic, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { EMPTY_ANSWERS, HORIZONS, type NotificationChoice, type SurveyAnswers } from '@/lib/onboarding-profile';
import { requestNotificationPermission } from '@/lib/notifications';
import { ACQUISITION_PLATFORMS } from '@/lib/preferences';
import { matchStates, NON_US, residenceLabel } from '@/lib/us-states';
import type { AcquisitionPlatform } from '@/types/bets';

/** How long the slide across to the next page takes. */
const SLIDE_MS = 420;
/** Pages this far from the current one are mounted; the rest stay unrendered. */
const RENDER_WINDOW = 1;

/** Mid-quiz scan: 3 bars inside about five seconds, then it moves on by itself. */
const SCAN_FILL_MS = 1300;
const SCAN_GAP_MS = 220;
const SCAN_TAIL_MS = 600;

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
  const advance = useCallback(() => {
    let next = index + 1;
    while (next < PAGE_IDS.length - 1 && !isPageVisible(PAGE_IDS[next], answers)) next++;
    setIndex(Math.min(PAGE_IDS.length - 1, next));
  }, [index, answers]);

  const back = useCallback(() => {
    // A retake opened from Settings can be backed out of from its first page.
    if (index === 0) {
      if (router.canGoBack()) router.back();
      return;
    }
    let prev = index - 1;
    while (prev > 0 && !isPageVisible(PAGE_IDS[prev], answers)) prev--;
    setIndex(Math.max(0, prev));
  }, [index, answers, router]);

  const nearby = useCallback((target: number) => Math.abs(target - index) <= RENDER_WINDOW, [index]);

  /* --------------------------------------------------------------- answers */

  const set = useCallback(<K extends keyof SurveyAnswers>(key: K, value: SurveyAnswers[K]) => {
    setAnswers((current) => ({ ...current, [key]: value }));
  }, []);

  /** Multi-select toggle for either of the two string-list answers still asked. */
  const toggleIn = useCallback((key: 'markets' | 'avoidPlatforms', value: string) => {
    setAnswers((current) => {
      const list = current[key];
      const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
      return { ...current, [key]: next };
    });
  }, []);

  /* ----------------------------------------------------------- permissions */

  const enableNotifications = useCallback(async () => {
    if (askingPermission) return;
    setAskingPermission(true);
    // The OS sheet is modal and sits there until it is answered — nothing may
    // move until it comes back, or the page slides out from under the prompt.
    const granted = await requestNotificationPermission().catch(() => false);
    setAskingPermission(false);
    setNotifications(granted ? 'enabled' : 'skipped');
    advance();
  }, [advance, askingPermission]);

  const skipNotifications = useCallback(() => {
    setNotifications('skipped');
    advance();
  }, [advance]);

  /* --------------------------------------------------------------- finish */

  const finish = useCallback(() => {
    if (submitting) return;
    setSubmitting(true);
    // The answers are handed to the build screen rather than saved here: that
    // screen performs the server write behind its own progress bars, so the
    // work is covered by something worth watching.
    void patchProfileAsync({ answers, notifications })
      .then(() => router.replace('/building-plan' as Href))
      .catch(() => setSubmitting(false));
  }, [answers, notifications, patchProfileAsync, router, submitting]);

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

/* ------------------------------------------------------------------- bodies */

interface BodyProps {
  id: PageId;
  answers: SurveyAnswers;
  compact: boolean;
  /** True only for the page currently on screen — animations idle otherwise. */
  active: boolean;
  askingPermission: boolean;
  set: <K extends keyof SurveyAnswers>(key: K, value: SurveyAnswers[K]) => void;
  toggleIn: (key: 'markets' | 'avoidPlatforms', value: string) => void;
  onScanDone: () => void;
  onBankConnected: () => void;
  onEnableNotifications: () => void;
  onSkipNotifications: () => void;
  onJumpTo: (index: number) => void;
}

function renderPageBody(props: BodyProps): React.ReactElement | null {
  const { id, answers, set, toggleIn } = props;

  switch (id) {
    case 'outcome':
      return (
        <View style={{ gap: 12 }}>
          <Options>
            {OUTCOMES.map((option) => (
              <Choice
                key={option.label}
                label={option.label}
                emoji={option.emoji}
                selected={answers.outcome === option.label}
                onPress={() => set('outcome', option.label)}
              />
            ))}
          </Options>
          {answers.outcome === SOMETHING_ELSE ? (
            <FreeText
              value={answers.outcomeOther}
              placeholder="What is it?"
              maxLength={60}
              onChangeText={(text) => set('outcomeOther', text)}
            />
          ) : null}
        </View>
      );

    case 'capital':
      return (
        <Options>
          {AMOUNTS.map((option) => (
            <Choice
              key={option.label}
              label={option.label}
              note={option.note}
              wide={option.label === SKIP}
              selected={answers.amount === option.label}
              onPress={() => set('amount', option.label)}
            />
          ))}
        </Options>
      );

    case 'horizon':
      return (
        <Options>
          {HORIZONS.map((option) => (
            <Choice
              key={option.value}
              label={option.label}
              note={option.note}
              selected={answers.horizon === option.value}
              onPress={() => set('horizon', option.value)}
            />
          ))}
        </Options>
      );

    case 'residence':
      return (
        <ResidencePicker
          value={answers.residenceState}
          onChange={(code) => set('residenceState', code)}
        />
      );

    case 'markets':
      return (
        <Options>
          {MARKETS.map((option) => (
            <Choice
              key={option.label}
              label={option.label}
              emoji={option.emoji}
              multi
              selected={answers.markets.includes(option.label)}
              onPress={() => toggleIn('markets', option.label)}
            />
          ))}
        </Options>
      );

    case 'platforms':
      return (
        <ServicesStep
          avoidPlatforms={answers.avoidPlatforms}
          bankConnected={answers.bankConnected}
          onTogglePlatform={(value) => toggleIn('avoidPlatforms', value)}
          onBankConnected={props.onBankConnected}
        />
      );

    case 'scan':
      return <LoaderPage tasks={scanTasks(answers)} active={props.active} onDone={props.onScanDone} />;

    case 'notifications':
      return (
        <NotificationAsk
          busy={props.askingPermission}
          onEnable={props.onEnableNotifications}
          onSkip={props.onSkipNotifications}
        />
      );

    case 'review':
      return <ReviewPage answers={answers} onJumpTo={props.onJumpTo} />;

    default:
      return null;
  }
}

/* -------------------------------------------------------------- page pieces */

/**
 * Fifty-one options is too many to scan as chips, so the list narrows as they
 * type — "new" leaves the four New states, "fl" leaves Florida. Nothing is
 * autofocused: most people scroll to their own state faster than they type it.
 */
function ResidencePicker({
  value,
  onChange,
}: {
  value: SurveyAnswers['residenceState'];
  onChange: (code: NonNullable<SurveyAnswers['residenceState']>) => void;
}): React.ReactElement {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const matches = matchStates(query);

  return (
    <View style={{ gap: 12 }}>
      <FreeText value={query} placeholder="Search states" maxLength={24} onChangeText={setQuery} />
      {matches.length > 0 ? (
        <Options>
          {matches.map((state) => (
            <Choice
              key={state.code}
              label={state.name}
              selected={value === state.code}
              onPress={() => onChange(state.code)}
            />
          ))}
        </Options>
      ) : (
        <ThemedText style={{ fontSize: 13, color: theme.textTertiary }}>No state matches that.</ThemedText>
      )}
      <Options>
        <Choice
          label="I live outside the US"
          wide
          selected={value === NON_US}
          onPress={() => onChange(NON_US)}
        />
      </Options>
    </View>
  );
}

function FreeText({
  value,
  placeholder,
  maxLength,
  onChangeText,
}: {
  value: string;
  placeholder: string;
  maxLength: number;
  onChangeText: (text: string) => void;
}): React.ReactElement {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      placeholderTextColor={theme.textTertiary}
      maxLength={maxLength}
      returnKeyType="done"
      style={{
        borderWidth: 1.5,
        borderRadius: Radius.md,
        borderColor: focused ? Brand[500] : theme.borderStrong,
        backgroundColor: theme.backgroundElement,
        color: theme.text,
        fontSize: 15,
        fontWeight: '600',
        paddingVertical: 13,
        paddingHorizontal: 14,
      }}
    />
  );
}

function LoaderPage({
  tasks,
  active,
  onDone,
}: {
  tasks: string[];
  active: boolean;
  onDone: () => void;
}): React.ReactElement {
  // Latched, so sliding back and forth does not replay the bars from zero.
  const [started, setStarted] = useState(active);
  if (active && !started) setStarted(true);

  return started ? <LoaderBars tasks={tasks} onDone={onDone} /> : <View style={{ flex: 1, minHeight: 160 }} />;
}

function LoaderBars({ tasks, onDone }: { tasks: string[]; onDone: () => void }): React.ReactElement {
  const progress = useTaskProgress({
    count: SCAN_TASK_COUNT,
    fillMs: SCAN_FILL_MS,
    gapMs: SCAN_GAP_MS,
    tailMs: SCAN_TAIL_MS,
    onDone,
  });

  return (
    <View style={{ gap: 18, paddingTop: 8 }}>
      {tasks.map((task, taskIndex) => (
        <TaskRow key={task} label={task} progress={progress} index={taskIndex} />
      ))}
    </View>
  );
}

/**
 * One acquisition platform, added by default. Tapping an added card doesn't
 * remove it on the spot — it opens the full-screen pitch below, since that
 * tap is the one moment worth interrupting with the real case for keeping it.
 * A dropped card stays in the list as a plain, quiet "add it back" row.
 */
function ServiceCard({
  platform,
  avoided,
  onRequestRemove,
  onAddBack,
}: {
  platform: (typeof ACQUISITION_PLATFORMS)[number];
  avoided: boolean;
  onRequestRemove: () => void;
  onAddBack: () => void;
}): React.ReactElement {
  const theme = useTheme();

  if (!avoided) {
    return (
      <Pressable
        onPress={onRequestRemove}
        accessibilityRole="button"
        accessibilityLabel={`${platform.label}, added. Tap to remove.`}
        className="flex-row items-center active:opacity-80"
        style={{
          gap: 12,
          padding: 14,
          borderRadius: Radius.lg,
          borderWidth: 1.5,
          borderColor: Brand[500] + '55',
          backgroundColor: theme.backgroundElevated,
          ...Shadow.card,
        }}>
        <View style={{ width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand[500] + '18' }}>
          <Icon glyph={platform.icon} size={20} color={Brand[500]} strokeWidth={1.75} />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <ThemedText style={{ fontSize: 14.5, fontWeight: '800', color: theme.text }}>{platform.label}</ThemedText>
          <ThemedText style={{ fontSize: 12, color: theme.textSecondary }}>{platform.description}</ThemedText>
        </View>
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: Radius.sm,
            backgroundColor: Brand[500],
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon glyph="✓" size={13} color={OnBrand} strokeWidth={3} />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onAddBack}
      accessibilityRole="button"
      accessibilityLabel={`${platform.label}, not added. Tap to add it back.`}
      className="flex-row items-center active:opacity-70"
      style={{
        gap: 12,
        padding: 14,
        borderRadius: Radius.lg,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: theme.border,
      }}>
      <View style={{ width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.backgroundSelected }}>
        <Icon glyph={platform.icon} size={20} color={theme.textTertiary} strokeWidth={1.75} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <ThemedText style={{ fontSize: 14.5, fontWeight: '800', color: theme.textTertiary }}>
          {platform.label} — not added
        </ThemedText>
        <ThemedText style={{ fontSize: 12, color: theme.textTertiary }}>Tap to add it back</ThemedText>
      </View>
    </Pressable>
  );
}

/**
 * The full-screen interstitial a removal tap opens. Its own screen rather than
 * a card swap in the list — this is the one moment in the quiz with real money
 * behind it (Pathey earns a referral kickback on every one of these three that
 * signs up), so it gets a real takeover, not something easy to miss scrolling
 * past a list. No invented stat or performance number (see the FACTS comment
 * on building-plan.tsx): the persuasion is what they'd lose, true by
 * construction of the other two platforms.
 */
const SERVICE_PITCH: Record<AcquisitionPlatform, { headline: string; body: string }> = {
  robinhood: {
    headline: "Don't skip Robinhood",
    body: "It's the only one of these three that prices stocks, ETFs, and crypto — Polymarket and Kalshi are prediction markets only. Skip it and every one of those routes disappears from your plan.",
  },
  polymarket: {
    headline: "Don't skip Polymarket",
    body: 'It carries the largest, most liquid prediction markets we track. Skip it and every prediction pick left comes from a thinner, less liquid book.',
  },
  kalshi: {
    headline: "Don't skip Kalshi",
    body: "It's a CFTC-regulated exchange. When a sports contract lists on both, we show you whichever is cheaper — skip it and you only ever see the Polymarket price.",
  },
};

/**
 * Where "sign up" links out to. Plain public sites, not referral links —
 * Pathey isn't enrolled in any of these programs yet (Robinhood's runs through
 * Impact, Polymarket's through Dub, Kalshi has its own). Swap these for the
 * real affiliate/referral URL the moment that enrollment exists; nothing else
 * here needs to change.
 */
const SERVICE_LINKS: Record<AcquisitionPlatform, string> = {
  robinhood: 'https://robinhood.com',
  polymarket: 'https://polymarket.com',
  kalshi: 'https://kalshi.com',
};

function ServicePitchModal({
  platform,
  onKeepIt,
  onRemoveAnyway,
}: {
  platform: (typeof ACQUISITION_PLATFORMS)[number] | null;
  onKeepIt: () => void;
  onRemoveAnyway: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const pitch = platform ? SERVICE_PITCH[platform.value] : null;

  return (
    <Modal visible={platform != null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onKeepIt}>
      <View className="flex-1" style={{ backgroundColor: theme.background }}>
        <OnboardingGlow />
        <SafeAreaView className="flex-1">
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28, gap: 20 }}
            showsVerticalScrollIndicator={false}>
            {platform && pitch ? (
              <>
                <View style={{ alignSelf: 'center', width: 84, height: 84, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand[500] + '1F' }}>
                  <Icon glyph={platform.icon} size={38} color={Brand[500]} strokeWidth={1.6} />
                </View>
                <ThemedText
                  style={{
                    fontSize: 27,
                    lineHeight: 32,
                    fontWeight: '900',
                    letterSpacing: -0.6,
                    color: theme.text,
                    textAlign: 'center',
                  }}>
                  {pitch.headline}
                </ThemedText>
                <ThemedText style={{ fontSize: 15.5, lineHeight: 22, color: theme.textSecondary, textAlign: 'center' }}>
                  {pitch.body}
                </ThemedText>
              </>
            ) : null}
          </ScrollView>
          <View className="px-7" style={{ gap: 10, paddingBottom: 22 }}>
            <Pressable
              onPress={() => {
                if (platform) void Linking.openURL(SERVICE_LINKS[platform.value]);
                onKeepIt();
              }}
              accessibilityRole="button"
              className="py-4 items-center active:opacity-85"
              style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], ...Shadow.card }}>
              <ThemedText style={{ fontSize: 16, fontWeight: '800', color: OnBrand, letterSpacing: -0.2 }}>
                Sign up for {platform?.label} →
              </ThemedText>
            </Pressable>
            <Pressable onPress={onKeepIt} accessibilityRole="button" className="py-3 items-center active:opacity-60">
              <ThemedText style={{ fontSize: 14, fontWeight: '700', color: theme.textSecondary }}>
                I already use it — keep it on
              </ThemedText>
            </Pressable>
            <Pressable onPress={onRemoveAnyway} accessibilityRole="button" className="py-2 items-center active:opacity-60">
              <ThemedText style={{ fontSize: 13, fontWeight: '600', color: theme.textTertiary }}>
                No thanks, remove it
              </ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/**
 * The fourth card: bank connect, folded in here rather than a page of its own.
 * Opens Plaid Link on "Connect" and writes `bankConnected` on a real success;
 * a plain user-closed-Link exit is neither an error nor a state change.
 *
 * `connected` comes from the stored answer, not only from this mount's own
 * hook state — someone who connects, backs up a page, and returns should see
 * the done state rather than the connect button again.
 */
function BankServiceCard({
  connected,
  onConnected,
}: {
  connected: boolean;
  onConnected: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const bank = useBankConnect();
  const done = connected || bank.connected;

  useEffect(() => {
    if (bank.connected) onConnected();
  }, [bank.connected, onConnected]);

  return (
    <View
      style={{
        gap: 10,
        padding: 14,
        borderRadius: Radius.lg,
        borderWidth: 1.5,
        borderColor: done ? Brand[500] + '55' : theme.border,
        backgroundColor: theme.backgroundElevated,
        ...Shadow.card,
      }}>
      <View className="flex-row items-center" style={{ gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? Brand[500] + '18' : theme.backgroundSelected }}>
          <Icon glyph="💳" size={20} color={done ? Brand[500] : theme.textSecondary} strokeWidth={1.75} />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <ThemedText style={{ fontSize: 14.5, fontWeight: '800', color: theme.text }}>Bank & credit cards</ThemedText>
          <ThemedText style={{ fontSize: 12, color: theme.textSecondary }}>
            {done
              ? bank.linkedCount > 1
                ? `${bank.linkedCount} linked. Add any other card you use so we see all of your spending.`
                : 'Linked. Add any other card you use so we see all of your spending.'
              : 'Link your bank and every card you use. We check which card each purchase should go on, and what you could cut.'}
          </ThemedText>
        </View>
        {done ? (
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: Radius.sm,
              backgroundColor: Brand[500],
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon glyph="✓" size={13} color={OnBrand} strokeWidth={3} />
          </View>
        ) : null}
      </View>
      {/* Each Link run connects one bank or card issuer, so after the first there is
          always a way to add the next one — cards are what the card-rewards routes
          are built from, and a wallet is rarely one issuer. */}
      <View style={{ gap: 8 }}>
        {bank.error ? (
          <ThemedText style={{ fontSize: 12, color: Semantic.negative }}>{bank.error}</ThemedText>
        ) : null}
        <Pressable
          onPress={() => void bank.connect()}
          disabled={bank.connecting}
          accessibilityRole="button"
          className="py-3 items-center active:opacity-85"
          style={{
            borderRadius: Radius.md,
            backgroundColor: done ? 'transparent' : Brand[500],
            borderWidth: done ? 1.5 : 0,
            borderColor: Brand[500],
            opacity: bank.connecting ? 0.6 : 1,
          }}>
          <ThemedText style={{ fontSize: 14, fontWeight: '800', color: done ? Brand[500] : OnBrand }}>
            {bank.connecting ? 'Connecting…' : done ? 'Add another card' : 'Connect a bank or card'}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

/** The platforms page: three acquisition platforms, added by default, plus bank connect. */
function ServicesStep({
  avoidPlatforms,
  bankConnected,
  onTogglePlatform,
  onBankConnected,
}: {
  avoidPlatforms: string[];
  bankConnected: boolean;
  onTogglePlatform: (value: string) => void;
  onBankConnected: () => void;
}): React.ReactElement {
  // Which platform the pitch screen is up for, if any — set only by an actual
  // removal tap, never by re-adding one, which needs no convincing.
  const [pitchFor, setPitchFor] = useState<AcquisitionPlatform | null>(null);
  const pitchPlatform = ACQUISITION_PLATFORMS.find((platform) => platform.value === pitchFor) ?? null;

  return (
    <View style={{ gap: 10 }}>
      {/* First, not fourth: the platforms below are on by default and need no
          action, so burying the one card that asks for something under three
          that don't left most people scrolling past it without seeing it. */}
      <BankServiceCard connected={bankConnected} onConnected={onBankConnected} />
      {ACQUISITION_PLATFORMS.map((platform) => (
        <ServiceCard
          key={platform.value}
          platform={platform}
          avoided={avoidPlatforms.includes(platform.value)}
          onRequestRemove={() => setPitchFor(platform.value)}
          onAddBack={() => onTogglePlatform(platform.value)}
        />
      ))}
      <ServicePitchModal
        platform={pitchPlatform}
        onKeepIt={() => setPitchFor(null)}
        onRemoveAnyway={() => {
          if (pitchFor) onTogglePlatform(pitchFor);
          setPitchFor(null);
        }}
      />
    </View>
  );
}

/**
 * The permission ask. It shows the actual banner rather than describing one, so
 * what is being agreed to is the thing that will really arrive.
 */
function NotificationAsk({
  busy,
  onEnable,
  onSkip,
}: {
  busy: boolean;
  onEnable: () => void;
  onSkip: () => void;
}): React.ReactElement {
  const theme = useTheme();

  return (
    <View style={{ flex: 1, gap: 16, justifyContent: 'space-between' }}>
      <View style={{ gap: 10 }}>
        <PushPreview
          title="Pathey"
          body="SGOV now pays more than what you're holding. 4.9%, and you can pull out any time."
        />
        <PushPreview title="Pathey" body="Your safety net hit $6,000. Good time to cash out." muted />
      </View>

      <View style={{ gap: 9 }}>
        <Pressable
          onPress={onEnable}
          disabled={busy}
          accessibilityRole="button"
          className="py-4 items-center active:opacity-85"
          style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], opacity: busy ? 0.6 : 1, ...Shadow.card }}>
          <ThemedText style={{ fontSize: 16, fontWeight: '800', color: OnBrand }}>
            {busy ? 'Waiting…' : 'Yes, keep me on track'}
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={onSkip}
          disabled={busy}
          accessibilityRole="button"
          className="py-3 items-center active:opacity-60">
          <ThemedText style={{ fontSize: 14, fontWeight: '700', color: theme.textTertiary }}>Maybe later</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

function PushPreview({ title, body, muted }: { title: string; body: string; muted?: boolean }): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      className="flex-row"
      style={{
        gap: 11,
        padding: 12,
        borderRadius: Radius.lg,
        backgroundColor: theme.backgroundElevated,
        borderWidth: 1,
        borderColor: theme.border,
        opacity: muted ? 0.55 : 1,
        ...Shadow.card,
      }}>
      <BrandMark size={34} />
      <View style={{ flex: 1, gap: 2 }}>
        <View className="flex-row items-center justify-between">
          <ThemedText style={{ fontSize: 12, fontWeight: '800', color: theme.text }}>{title}</ThemedText>
          <ThemedText style={{ fontSize: 10.5, color: theme.textTertiary }}>now</ThemedText>
        </View>
        <ThemedText style={{ fontSize: 12.5, lineHeight: 17, color: theme.textSecondary }}>{body}</ThemedText>
      </View>
    </View>
  );
}

/** The last page: everything read back, and every line jumps to where it was set. */
function ReviewPage({
  answers,
  onJumpTo,
}: {
  answers: SurveyAnswers;
  onJumpTo: (index: number) => void;
}): React.ReactElement {
  const theme = useTheme();

  const rows: { label: string; value: string; page: PageId }[] = [
    {
      label: 'Goal',
      value: (answers.outcome === SOMETHING_ELSE ? answers.outcomeOther.trim() : answers.outcome) || '—',
      page: 'outcome',
    },
    { label: 'Ways', value: answers.markets.join(', ') || 'Everything', page: 'markets' },
    { label: 'Can put in', value: answers.amount || '—', page: 'capital' },
    {
      label: 'Timeframe',
      value: HORIZONS.find((item) => item.value === answers.horizon)?.label ?? '—',
      page: 'horizon',
    },
    { label: 'State', value: residenceLabel(answers.residenceState) ?? '—', page: 'residence' },
    {
      label: 'Services',
      value: [
        ...ACQUISITION_PLATFORMS.filter((p) => !answers.avoidPlatforms.includes(p.value)).map((p) => p.label),
        answers.bankConnected ? 'bank connected' : null,
      ].filter((item): item is string => Boolean(item)).join(', ') || 'None added',
      page: 'platforms',
    },
  ];

  return (
    <View
      style={{
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.backgroundElement,
        overflow: 'hidden',
      }}>
      {rows.map((row, rowIndex) => (
        <Pressable
          key={row.label}
          onPress={() => onJumpTo(PAGE_IDS.indexOf(row.page))}
          accessibilityRole="button"
          accessibilityLabel={`${row.label}: ${row.value}. Tap to change.`}
          className="flex-row items-center active:opacity-70"
          style={{
            gap: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderTopWidth: rowIndex === 0 ? 0 : 1,
            borderTopColor: theme.border,
          }}>
          <ThemedText style={{ width: 86, fontSize: 11.5, fontWeight: '800', color: theme.textTertiary }}>
            {row.label.toUpperCase()}
          </ThemedText>
          <ThemedText style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: theme.text }}>
            {row.value}
          </ThemedText>
          <ThemedText style={{ fontSize: 13, color: Brand[500], fontWeight: '800' }}>edit</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}
