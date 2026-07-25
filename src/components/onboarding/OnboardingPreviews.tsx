import React, { useEffect, useState } from 'react';
import { Animated, Easing, useWindowDimensions, View } from 'react-native';

import {
  BREAKDOWN_FACTORS,
  BREAKDOWN_SCORE,
  CLOSING_PROOF,
  COACH_SCRIPT,
  COACH_STARTERS,
  OnboardingSlide,
  RANKED_PREVIEW,
  SCAN_SOURCES,
} from '@/components/onboarding/onboarding-data';
import { ThemedText } from '@/components/themed-text';
import { Accent, Brand, Radius, RiskScale, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { scoreColor, scoreLabel } from '@/lib/score';

export { OnboardingGlow } from '@/components/onboarding/OnboardingGlow';

const MONO = { fontVariant: ['tabular-nums' as const] };

/**
 * `active` is true only for the slide currently on screen. Previews use it to replay
 * their reveal when the user lands on them — an animation that already finished while
 * the user was three slides back is a wasted one — and to idle when off screen.
 */
interface PreviewProps {
  active: boolean;
}

/** Small phones (SE-class) tighten rows and drop the optional ones rather than squeezing. */
function useCompact(): boolean {
  const { height } = useWindowDimensions();
  return height > 0 && height < 740;
}

/* ------------------------------------------------------------------ primitives */

/**
 * Every preview lives in the same framed panel — a titlebar plus body. Consistent
 * framing is what stops five different illustrations from looking like five different
 * apps, and it reads as a slice of the real product rather than marketing art.
 */
function Panel({
  title,
  chip,
  chipColor,
  children,
}: {
  title: string;
  chip?: string;
  chipColor?: string;
  children: React.ReactNode;
}): React.ReactElement {
  const theme = useTheme();
  const accent = chipColor ?? Brand[500];

  return (
    <View
      style={{
        borderRadius: Radius.xl,
        overflow: 'hidden',
        backgroundColor: theme.backgroundElevated,
        borderWidth: 1,
        borderColor: theme.border,
        ...Shadow.card,
      }}>
      <View
        className="flex-row items-center justify-between"
        style={{
          paddingHorizontal: 14,
          paddingVertical: 10,
          backgroundColor: theme.backgroundElement,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}>
        <ThemedText style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: theme.textTertiary }}>
          {title}
        </ThemedText>
        {chip ? (
          <View
            className="flex-row items-center"
            style={{
              gap: 5,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: Radius.pill,
              backgroundColor: accent + '18',
              borderWidth: 1,
              borderColor: accent + '3D',
            }}>
            <View style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: accent }} />
            <ThemedText style={{ fontSize: 9, fontWeight: '800', letterSpacing: 0.4, color: accent }}>{chip}</ThemedText>
          </View>
        ) : null}
      </View>
      <View style={{ padding: 12, gap: 8 }}>{children}</View>
    </View>
  );
}

/** Fades + lifts its children in once on mount. Used for the scripted coach exchange. */
function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }): React.ReactElement {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 320,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}>
      {children}
    </Animated.View>
  );
}

/**
 * 0 → 1 driver for the score bars, restarted whenever the slide becomes active so the
 * fill happens in front of the user. Width animation, so JS driver by necessity.
 */
function useReplayedGrow(active: boolean, duration: number): Animated.Value {
  const [grow] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!active) {
      grow.setValue(0);
      return;
    }
    const animation = Animated.timing(grow, {
      toValue: 1,
      duration,
      delay: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [active, duration, grow]);

  return grow;
}

function Bar({
  fraction,
  color,
  height = 4,
}: {
  fraction: Animated.AnimatedInterpolation<string>;
  color: string;
  height?: number;
}) {
  const theme = useTheme();
  return (
    <View style={{ height, borderRadius: 999, backgroundColor: theme.backgroundSelected, overflow: 'hidden' }}>
      <Animated.View style={{ width: fraction, height, borderRadius: 999, backgroundColor: color }} />
    </View>
  );
}

/* ------------------------------------------------------------------ slide 1: scan */

function ScanPreview({ active }: PreviewProps): React.ReactElement {
  const theme = useTheme();
  const compact = useCompact();
  const [cursor, setCursor] = useState(0);
  const [pulse] = useState(() => new Animated.Value(0));

  // The cursor walks down the list once, then rests on "ready". renderOnboardingPreview
  // remounts the preview when the slide becomes active, so this replays per visit.
  useEffect(() => {
    if (!active || cursor >= SCAN_SOURCES.length) return;
    const timer = setTimeout(() => setCursor(cursor + 1), 620);
    return () => clearTimeout(timer);
  }, [active, cursor]);

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  const done = cursor >= SCAN_SOURCES.length;

  return (
    <View className="flex-1 justify-center">
      <Panel title="SCANNING MARKETS" chip={done ? 'READY' : 'LIVE'}>
        {SCAN_SOURCES.map((source, index) => {
          const scanned = index < cursor;
          const scanning = index === cursor;
          return (
            <View
              key={source.label}
              className="flex-row items-center"
              style={{
                gap: 10,
                paddingHorizontal: 10,
                paddingVertical: compact ? 7 : 9,
                borderRadius: Radius.md,
                backgroundColor: scanning ? source.color + '14' : 'transparent',
                borderWidth: 1,
                borderColor: scanning ? source.color + '3D' : 'transparent',
              }}>
              <View
                className="items-center justify-center"
                style={{ width: 28, height: 28, borderRadius: Radius.sm, backgroundColor: source.color + '1F' }}>
                <ThemedText style={{ fontSize: 14 }}>{source.emoji}</ThemedText>
              </View>
              <View className="flex-1">
                <ThemedText style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{source.label}</ThemedText>
                <ThemedText style={{ fontSize: 10.5, color: theme.textTertiary }}>{source.detail}</ThemedText>
              </View>
              {scanned ? (
                <ThemedText style={{ fontSize: 12, fontWeight: '900', color: Brand[500] }}>✓</ThemedText>
              ) : scanning ? (
                <Animated.View style={{ opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }}>
                  <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: source.color }} />
                </Animated.View>
              ) : (
                <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: theme.backgroundSelected }} />
              )}
            </View>
          );
        })}

        <View style={{ height: 1, backgroundColor: theme.border, marginHorizontal: 2, marginTop: 2 }} />
        <View className="flex-row items-center justify-between" style={{ paddingHorizontal: 10, paddingTop: 2 }}>
          <ThemedText style={{ fontSize: 11, color: theme.textSecondary }}>
            {done ? 'Every option priced' : 'Pulling live prices…'}
          </ThemedText>
          <ThemedText style={{ fontSize: 11, fontWeight: '800', color: done ? Brand[500] : theme.textTertiary, ...MONO }}>
            {Math.min(cursor, SCAN_SOURCES.length)}/{SCAN_SOURCES.length} markets
          </ThemedText>
        </View>
      </Panel>
    </View>
  );
}

/* ------------------------------------------------------------------ slide 2: rank */

function RankPreview({ active }: PreviewProps): React.ReactElement {
  const theme = useTheme();
  const compact = useCompact();
  const grow = useReplayedGrow(active, 1100);

  return (
    <View className="flex-1 justify-center">
      <Panel title="RANKED FOR YOUR GOAL" chip="BY VALUE">
        {RANKED_PREVIEW.map((row, index) => {
          const sc = scoreColor(row.score);
          const rc = RiskScale[row.riskLevel - 1] ?? theme.textTertiary;
          const top = index === 0;
          return (
            <View
              key={row.name}
              style={{
                paddingHorizontal: 10,
                paddingVertical: compact ? 7 : 9,
                borderRadius: Radius.md,
                gap: 7,
                backgroundColor: top ? Brand[500] + '12' : 'transparent',
                borderWidth: 1,
                borderColor: top ? Brand[500] + '3D' : 'transparent',
              }}>
              <View className="flex-row items-center" style={{ gap: 9 }}>
                <ThemedText
                  style={{ fontSize: 11, fontWeight: '900', color: top ? Brand[500] : theme.textTertiary, width: 18, ...MONO }}>
                  {index + 1}
                </ThemedText>
                <ThemedText style={{ fontSize: 14 }}>{row.emoji}</ThemedText>
                <View className="flex-1">
                  <ThemedText style={{ fontSize: 12.5, fontWeight: '700', color: theme.text }} numberOfLines={1}>
                    {row.name}
                  </ThemedText>
                  <View className="flex-row items-center" style={{ gap: 5 }}>
                    <View style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: rc }} />
                    <ThemedText style={{ fontSize: 10, color: theme.textTertiary }} numberOfLines={1}>
                      {row.platform} · {row.note}
                    </ThemedText>
                  </View>
                </View>
                <View className="items-end">
                  <ThemedText style={{ fontSize: 15, fontWeight: '900', color: sc, ...MONO }}>{row.score}</ThemedText>
                  <ThemedText style={{ fontSize: 8.5, fontWeight: '800', color: sc, letterSpacing: 0.2 }}>
                    {scoreLabel(row.score).toUpperCase()}
                  </ThemedText>
                </View>
              </View>
              <Bar
                fraction={grow.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${row.score}%`] })}
                color={sc}
                height={3}
              />
            </View>
          );
        })}
      </Panel>
      <ThemedText style={{ fontSize: 10.5, color: theme.textTertiary, textAlign: 'center', marginTop: 10 }}>
        Chance 35% · safety 25% · cash 30% · time 10%
      </ThemedText>
    </View>
  );
}

/* ------------------------------------------------------------------ slide 3: breakdown */

function BreakdownPreview({ active }: PreviewProps): React.ReactElement {
  const theme = useTheme();
  const compact = useCompact();
  const sc = scoreColor(BREAKDOWN_SCORE);
  const grow = useReplayedGrow(active, 900);

  const formula = BREAKDOWN_FACTORS.map((factor) => factor.points.toFixed(1)).join(' + ');

  return (
    <View className="flex-1 justify-center">
      <Panel title="SCORE MATH · VOO" chip="AUDITABLE">
        <View className="flex-row items-end justify-between" style={{ paddingHorizontal: 10, paddingBottom: 2 }}>
          <View>
            <ThemedText style={{ fontSize: 11, color: theme.textSecondary }}>Value score</ThemedText>
            <View className="flex-row items-baseline" style={{ gap: 3 }}>
              <ThemedText style={{ fontSize: 30, fontWeight: '900', color: sc, letterSpacing: -1, ...MONO }}>
                {BREAKDOWN_SCORE}
              </ThemedText>
              <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.textTertiary, ...MONO }}>/100</ThemedText>
            </View>
          </View>
          <View
            style={{
              paddingHorizontal: 9,
              paddingVertical: 4,
              borderRadius: Radius.pill,
              backgroundColor: sc + '18',
              borderWidth: 1,
              borderColor: sc + '3D',
            }}>
            <ThemedText style={{ fontSize: 10, fontWeight: '800', color: sc }}>{scoreLabel(BREAKDOWN_SCORE)}</ThemedText>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: theme.border, marginHorizontal: 2 }} />

        {BREAKDOWN_FACTORS.map((factor) => (
          <View key={factor.label} style={{ paddingHorizontal: 10, gap: 5, paddingVertical: 2 }}>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <ThemedText style={{ fontSize: 11.5, fontWeight: '600', color: theme.text }}>{factor.label}</ThemedText>
                <ThemedText style={{ fontSize: 9.5, fontWeight: '800', color: theme.textTertiary, ...MONO }}>
                  {factor.weight}
                </ThemedText>
              </View>
              <ThemedText style={{ fontSize: 11.5, fontWeight: '800', color: theme.text, ...MONO }}>
                +{factor.points.toFixed(1)}
              </ThemedText>
            </View>
            <Bar
              fraction={grow.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${factor.raw}%`] })}
              color={Brand[500]}
              height={3}
            />
          </View>
        ))}

        <View style={{ height: 1, backgroundColor: theme.border, marginHorizontal: 2 }} />

        <ThemedText style={{ fontSize: 11.5, fontWeight: '800', color: theme.text, paddingHorizontal: 10, ...MONO }}>
          {formula} = {BREAKDOWN_SCORE}
        </ThemedText>

        {compact ? null : (
          <View
            style={{
              marginHorizontal: 6,
              padding: 10,
              borderRadius: Radius.md,
              backgroundColor: Accent.gold + '12',
              borderWidth: 1,
              borderColor: Accent.gold + '33',
              gap: 3,
            }}>
            <ThemedText style={{ fontSize: 9.5, fontWeight: '800', color: Accent.gold, letterSpacing: 0.4 }}>
              IF IT GOES AGAINST YOU
            </ThemedText>
            <ThemedText style={{ fontSize: 11, color: theme.textSecondary, lineHeight: 16 }}>
              Capital preserved — a drawdown, not a wipeout. All-or-nothing routes say so, right here.
            </ThemedText>
          </View>
        )}

        <ThemedText style={{ fontSize: 10, color: theme.textTertiary, paddingHorizontal: 10 }}>
          Live quote · source and timestamp shown on every route
        </ThemedText>
      </Panel>
    </View>
  );
}

/* ------------------------------------------------------------------ slide 4: coach */

function TypingDots(): React.ReactElement {
  const theme = useTheme();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: 1050, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  return (
    <View
      className="flex-row items-center"
      style={{
        alignSelf: 'flex-start',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 11,
        borderRadius: Radius.lg,
        backgroundColor: theme.backgroundElement,
        borderWidth: 1,
        borderColor: theme.border,
      }}>
      {[0, 1, 2].map((index) => (
        <Animated.View
          key={index}
          style={{
            width: 5,
            height: 5,
            borderRadius: 999,
            backgroundColor: Brand[500],
            opacity: progress.interpolate({
              inputRange: [0, index / 3, (index + 1) / 3, 1],
              outputRange: [0.3, 1, 0.3, 0.3],
            }),
          }}
        />
      ))}
    </View>
  );
}

function CoachPreview({ active }: PreviewProps): React.ReactElement {
  const theme = useTheme();
  const compact = useCompact();
  // 0: starters only · 1: question sent · 2: coach typing · 3: answer (rests here)
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!active || stage >= 3) return;
    const timer = setTimeout(() => setStage(stage + 1), [700, 600, 1300][stage]);
    return () => clearTimeout(timer);
  }, [active, stage]);

  const [question, answer] = COACH_SCRIPT;

  return (
    <View className="flex-1 justify-center">
      <Panel title="AI COACH" chip="ON CALL">
        <View
          className="flex-row items-center justify-between"
          style={{
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: Radius.md,
            backgroundColor: theme.backgroundElement,
            borderWidth: 1,
            borderColor: theme.border,
          }}>
          <ThemedText style={{ fontSize: 10.5, color: theme.textTertiary }}>Reading this route</ThemedText>
          <ThemedText style={{ fontSize: 10.5, fontWeight: '800', color: Brand[500], ...MONO }}>VOO · 82/100</ThemedText>
        </View>

        {/* Starter prompts double as filler while the scripted exchange plays in. */}
        <View className="flex-row flex-wrap" style={{ gap: 5 }}>
          {COACH_STARTERS.map((starter, index) => (
            <View
              key={starter}
              style={{
                paddingHorizontal: 9,
                paddingVertical: 5,
                borderRadius: Radius.pill,
                backgroundColor: index === 0 && stage >= 1 ? Brand[500] + '1F' : theme.backgroundElement,
                borderWidth: 1,
                borderColor: index === 0 && stage >= 1 ? Brand[500] + '3D' : theme.border,
              }}>
              <ThemedText
                style={{
                  fontSize: 10.5,
                  fontWeight: '700',
                  color: index === 0 && stage >= 1 ? Brand[500] : theme.textSecondary,
                }}>
                {starter}
              </ThemedText>
            </View>
          ))}
        </View>

        <View style={{ gap: 7, minHeight: compact ? 128 : 150, justifyContent: 'flex-end' }}>
          {stage >= 1 ? (
            <FadeIn>
              <View
                style={{
                  alignSelf: 'flex-end',
                  maxWidth: '86%',
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  borderRadius: Radius.lg,
                  backgroundColor: Brand[500],
                }}>
                <ThemedText style={{ fontSize: 12.5, fontWeight: '700', color: '#06140C', lineHeight: 18 }}>
                  {question.text}
                </ThemedText>
              </View>
            </FadeIn>
          ) : null}

          {stage === 2 ? <TypingDots /> : null}

          {stage >= 3 ? (
            <FadeIn>
              <View
                style={{
                  alignSelf: 'flex-start',
                  maxWidth: '92%',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: Radius.lg,
                  backgroundColor: theme.backgroundElement,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}>
                <ThemedText style={{ fontSize: 12.5, color: theme.text, lineHeight: 18 }}>{answer.text}</ThemedText>
              </View>
            </FadeIn>
          ) : null}
        </View>

        <View
          className="flex-row items-center"
          style={{
            gap: 8,
            paddingLeft: 12,
            paddingRight: 6,
            paddingVertical: 6,
            borderRadius: Radius.lg,
            backgroundColor: theme.backgroundElement,
            borderWidth: 1,
            borderColor: theme.border,
          }}>
          <ThemedText style={{ fontSize: 12, color: theme.textTertiary, flex: 1 }}>Ask why, risk, sizing…</ThemedText>
          <View style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: Radius.md, backgroundColor: Brand[500] }}>
            <ThemedText style={{ fontSize: 11, fontWeight: '800', color: '#06140C' }}>Send</ThemedText>
          </View>
        </View>
      </Panel>
    </View>
  );
}

/* ------------------------------------------------------------------ slide 5: close */

function ClosePreview(): React.ReactElement {
  // Static by design: the closing slide should read as a finished plan, not an animation.
  const theme = useTheme();
  const compact = useCompact();
  const sc = scoreColor(BREAKDOWN_SCORE);

  return (
    <View className="flex-1 justify-center" style={{ gap: 10 }}>
      <Panel title="YOUR GOAL" chip="1 MIN SETUP">
        <View className="flex-row items-center justify-between" style={{ paddingHorizontal: 10, paddingVertical: 2 }}>
          <View>
            <ThemedText style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: theme.textTertiary }}>
              TARGET
            </ThemedText>
            <View className="flex-row items-baseline" style={{ gap: 6 }}>
              <ThemedText style={{ fontSize: 22, fontWeight: '900', color: theme.text, letterSpacing: -0.7, ...MONO }}>
                $300
              </ThemedText>
              <ThemedText style={{ fontSize: 14, color: theme.textTertiary }}>→</ThemedText>
              <ThemedText style={{ fontSize: 22, fontWeight: '900', color: Brand[500], letterSpacing: -0.7, ...MONO }}>
                $330
              </ThemedText>
            </View>
          </View>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: Radius.pill,
              backgroundColor: theme.backgroundSelected,
            }}>
            <ThemedText style={{ fontSize: 10.5, fontWeight: '800', color: theme.textSecondary }}>by Dec 31</ThemedText>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: theme.border, marginHorizontal: 2 }} />

        <View
          className="flex-row items-center"
          style={{
            gap: 10,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: Radius.md,
            backgroundColor: Brand[500] + '12',
            borderWidth: 1,
            borderColor: Brand[500] + '3D',
          }}>
          <ThemedText style={{ fontSize: 16 }}>📈</ThemedText>
          <View className="flex-1">
            <ThemedText style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.5, color: Brand[500] }}>
              #1 BEST VALUE
            </ThemedText>
            <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.text }} numberOfLines={1}>
              VOO · capital preserved
            </ThemedText>
          </View>
          <ThemedText style={{ fontSize: 16, fontWeight: '900', color: sc, ...MONO }}>{BREAKDOWN_SCORE}</ThemedText>
        </View>
      </Panel>

      <View style={{ gap: 6 }}>
        {CLOSING_PROOF.map((proof) => (
          <View
            key={proof.label}
            className="flex-row items-center"
            style={{
              gap: 10,
              paddingHorizontal: 12,
              paddingVertical: compact ? 8 : 10,
              borderRadius: Radius.lg,
              backgroundColor: theme.backgroundElevated,
              borderWidth: 1,
              borderColor: theme.border,
            }}>
            <ThemedText style={{ fontSize: 14 }}>{proof.emoji}</ThemedText>
            <ThemedText style={{ fontSize: 12.5, fontWeight: '600', color: theme.text, flex: 1 }}>{proof.label}</ThemedText>
            <ThemedText style={{ fontSize: 12, fontWeight: '900', color: Brand[500] }}>✓</ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */

/**
 * The `key` swap is deliberate: flipping active remounts the preview, which restarts its
 * reveal from a clean state without any reset-in-effect gymnastics.
 */
export function renderOnboardingPreview(kind: OnboardingSlide['kind'], active: boolean): React.ReactElement {
  const key = active ? 'active' : 'idle';
  switch (kind) {
    case 'scan':
      return <ScanPreview key={key} active={active} />;
    case 'rank':
      return <RankPreview key={key} active={active} />;
    case 'breakdown':
      return <BreakdownPreview key={key} active={active} />;
    case 'coach':
      return <CoachPreview key={key} active={active} />;
    case 'close':
      return <ClosePreview />;
  }
}
