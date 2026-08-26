import { useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useOnboardingProfile } from '@/api/hooks/useOnboardingProfile';
import { useRoutePrefetch } from '@/api/hooks/useRoutePrefetch';
import { OnboardingGlow } from '@/components/onboarding/OnboardingPreviews';
import { Choice, Options, PageHead, TaskRow, useSpokenLine, useTaskProgress } from '@/components/onboarding/quiz-kit';
import {
  AGE_RANGES,
  AMOUNTS,
  buildPageCopy,
  CAN_CONTINUE,
  EXPERIENCE_LEVELS,
  MARKETS,
    OUTCOMES,
  PAGE_IDS,
  profilingTasks,
  SCAN_TASK_COUNT,
  scanTasks,
  SKIP,
  SOMETHING_ELSE,
  type PageId,
} from '@/components/onboarding/quiz-pages';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  EMPTY_ANSWERS,
  HORIZONS,
  LOSS_REACTIONS,
  MOTIVATIONS,
  type Motivation,
  type NotificationChoice,
  type SurveyAnswers,
} from '@/lib/onboarding-profile';
import { requestNotificationPermission } from '@/lib/notifications';
import { ACQUISITION_PLATFORMS } from '@/lib/preferences';

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

  // Start warming market data at the first pause, four answers in. Early enough to
  // buy the search most of a minute, late enough that someone who bounces off the
  // first question never triggers it.
  useRoutePrefetch(index >= PAGE_IDS.indexOf('profiling'));
  const copy = buildPageCopy(answers, name, notifications);
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

  const advance = useCallback(() => {
    setIndex((current) => Math.min(PAGE_IDS.length - 1, current + 1));
  }, []);

  const back = useCallback(() => {
    setIndex((current) => Math.max(0, current - 1));
  }, []);

  const nearby = useCallback((target: number) => Math.abs(target - index) <= RENDER_WINDOW, [index]);

  /* --------------------------------------------------------------- answers */

  const set = useCallback(<K extends keyof SurveyAnswers>(key: K, value: SurveyAnswers[K]) => {
    setAnswers((current) => ({ ...current, [key]: value }));
  }, []);

  const toggleMotivation = useCallback((value: Motivation) => {
    setAnswers((current) => ({
      ...current,
      motivations: current.motivations.includes(value)
        ? current.motivations.filter((item) => item !== value)
        : [...current.motivations, value],
    }));
  }, []);

  /** Multi-select toggle for any of the three string-list answers. */
  const toggleIn = useCallback((key: 'markets' | 'avoidMarkets' | 'avoidPlatforms', value: string) => {
    setAnswers((current) => {
      const list = current[key];
      const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
      if (key !== 'avoidMarkets') return { ...current, [key]: next };
      // Something they have just ruled out cannot also be something they are
      // drawn to — the two lists would contradict each other on the review page.
      return { ...current, avoidMarkets: next, markets: current.markets.filter((item) => !next.includes(item)) };
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
  const hidesFooter = pageId === 'scan' || pageId === 'profiling' || pageId === 'notifications';

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
              disabled={index === 0}
              accessibilityRole="button"
              accessibilityLabel="Back"
              className="active:opacity-60"
              style={{ opacity: index === 0 ? 0 : 1, paddingVertical: 4, paddingRight: 4 }}>
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
          <ThemedText style={{ fontSize: 9.5, fontWeight: '900', letterSpacing: 1, color: Brand[500] }}>
            BUILDING YOUR PLAN
          </ThemedText>
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
                      toggleMotivation,
                      toggleIn,
                      onScanDone: advance,
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
              <ThemedText style={{ fontSize: 16, fontWeight: '800', color: '#06140C', letterSpacing: -0.2 }}>
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
  toggleMotivation: (value: Motivation) => void;
  toggleIn: (key: 'markets' | 'avoidMarkets' | 'avoidPlatforms', value: string) => void;
  onScanDone: () => void;
  onEnableNotifications: () => void;
  onSkipNotifications: () => void;
  onJumpTo: (index: number) => void;
}

function renderPageBody(props: BodyProps): React.ReactElement | null {
  const { id, answers, set, toggleMotivation, toggleIn } = props;

  switch (id) {
    case 'motivation':
      return (
        <Options>
          {MOTIVATIONS.map((option) => (
            <Choice
              key={option}
              label={option}
              multi
              selected={answers.motivations.includes(option)}
              onPress={() => toggleMotivation(option)}
            />
          ))}
        </Options>
      );

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

    case 'experience':
      return (
        <Options>
          {EXPERIENCE_LEVELS.map((option) => (
            <Choice
              key={option.label}
              label={option.label}
              note={option.note}
              selected={answers.experience === option.label}
              onPress={() => set('experience', option.label)}
            />
          ))}
        </Options>
      );

    case 'starting_point':
      return (
        <View style={{ gap: 18 }}>
          <Field label="Age">
            <Options gap={7}>
              {AGE_RANGES.map((option) => (
                <Choice
                  key={option}
                  label={option}
                  selected={answers.ageRange === option}
                  onPress={() => set('ageRange', option)}
                />
              ))}
            </Options>
          </Field>
        </View>
      );

    case 'profiling':
      return (
        <LoaderPage tasks={profilingTasks(answers)} active={props.active} onDone={props.onScanDone} />
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

    case 'loss_reaction':
      return (
        <Options>
          {LOSS_REACTIONS.map((option) => (
            <Choice
              key={option.value}
              label={option.label}
              note={option.note}
              selected={answers.lossReaction === option.value}
              onPress={() => set('lossReaction', option.value)}
            />
          ))}
        </Options>
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

    case 'avoid_markets':
      return (
        <Options>
          {MARKETS.map((option) => (
            <Choice
              key={option.label}
              label={option.label}
              emoji={option.emoji}
              multi
              selected={answers.avoidMarkets.includes(option.label)}
              onPress={() => toggleIn('avoidMarkets', option.label)}
            />
          ))}
        </Options>
      );

    case 'avoid_platforms':
      return (
        <Options>
          {ACQUISITION_PLATFORMS.map((option) => (
            <Choice
              key={option.value}
              label={option.label}
              note={option.description}
              emoji={option.icon}
              multi
              wide
              selected={answers.avoidPlatforms.includes(option.value)}
              onPress={() => toggleIn('avoidPlatforms', option.value)}
            />
          ))}
        </Options>
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

function Field({ label, children }: React.PropsWithChildren<{ label: string }>): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={{ gap: 9 }}>
      <ThemedText style={{ fontSize: 10.5, fontWeight: '900', letterSpacing: 0.9, color: theme.textTertiary }}>
        {label.toUpperCase()}
      </ThemedText>
      {children}
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
          <ThemedText style={{ fontSize: 16, fontWeight: '800', color: '#06140C' }}>
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
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: Radius.sm,
          backgroundColor: Brand[500],
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <ThemedText style={{ fontSize: 17, fontWeight: '900', color: '#06140C' }}>$</ThemedText>
      </View>
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

/** Platform values back to the names people recognise, for the review page. */
function platformLabels(values: string[]): string[] {
  return ACQUISITION_PLATFORMS.filter((platform) => values.includes(platform.value)).map((p) => p.label);
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
    { label: 'Why', value: answers.motivations.join(', ') || '—', page: 'motivation' },
    {
      label: 'Goal',
      value: (answers.outcome === SOMETHING_ELSE ? answers.outcomeOther.trim() : answers.outcome) || '—',
      page: 'outcome',
    },
    { label: 'Experience', value: answers.experience || '—', page: 'experience' },
    { label: 'Can put in', value: answers.amount || '—', page: 'capital' },
    {
      label: 'Timeframe',
      value: HORIZONS.find((item) => item.value === answers.horizon)?.label ?? '—',
      page: 'horizon',
    },
    {
      label: 'If it drops',
      value: LOSS_REACTIONS.find((item) => item.value === answers.lossReaction)?.label ?? '—',
      page: 'loss_reaction',
    },
    { label: 'Markets', value: answers.markets.join(', ') || 'Everything', page: 'markets' },
    {
      label: 'Never show',
      value: [...answers.avoidMarkets, ...platformLabels(answers.avoidPlatforms)].join(', ') || 'Nothing ruled out',
      page: 'avoid_markets',
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
