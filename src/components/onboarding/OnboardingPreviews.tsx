import React, { useEffect, useState } from 'react';
import { Animated, Easing, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import {
  BREAKDOWN_FACTORS,
  CLOSING_PROOF,
  COACH_SCRIPT,
  COACH_STARTERS,
  OnboardingSlide,
  RANKED_PREVIEW,
} from '@/components/onboarding/onboarding-data';
import { ThemedText } from '@/components/themed-text';
import { Accent, Brand, Radius, RiskScale, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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

/* ------------------------------------------------------------------ slide 1: scan */

/** A four-point sparkle that twinkles — scale, opacity and a slight tilt on a loop. */
function Sparkle({
  style,
  size = 20,
  color,
  delay = 0,
  duration = 1400,
}: {
  style: object;
  size?: number;
  color: string;
  delay?: number;
  duration?: number;
}): React.ReactElement {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration, delay, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(progress, { toValue: 0, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [progress, delay, duration]);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1.15] });
  const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['-10deg', '10deg'] });

  return (
    <Animated.View style={[style, { opacity, transform: [{ scale }, { rotate }] }]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z" fill={color} />
      </Svg>
    </Animated.View>
  );
}

/**
 * The tagline slide: a hero mark that breathes and bobs, ringed by twinkling sparkles,
 * rather than a product panel — this is the pitch, not a screenshot of the app yet.
 */
function ScanHero({ active }: PreviewProps): React.ReactElement {
  const [bob] = useState(() => new Animated.Value(0));
  const [glow] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!active) return;
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    bobLoop.start();
    glowLoop.start();
    return () => {
      bobLoop.stop();
      glowLoop.stop();
    };
  }, [active, bob, glow]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.08] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.95] });

  return (
    <View className="flex-1 items-center justify-center">
      <View style={{ width: 240, height: 240, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          style={{
            position: 'absolute',
            width: 220,
            height: 220,
            borderRadius: 110,
            backgroundColor: Brand[500] + '26',
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          }}
        />

        <Sparkle style={{ position: 'absolute', top: 14, left: 4 }} color={Brand[300]} size={22} delay={0} duration={1300} />
        <Sparkle
          style={{ position: 'absolute', top: 34, right: 0 }}
          color={Accent.gold}
          size={15}
          delay={260}
          duration={1250}
        />
        <Sparkle
          style={{ position: 'absolute', bottom: 28, left: 20 }}
          color={Brand[600]}
          size={17}
          delay={480}
          duration={1500}
        />

        <Animated.View
          style={{
            transform: [{ translateY }],
            width: 112,
            height: 112,
            borderRadius: Radius.xl,
            backgroundColor: Brand[500],
            alignItems: 'center',
            justifyContent: 'center',
            ...Shadow.card,
          }}>
          <Svg width={62} height={62} viewBox="0 0 62 62">
            <Circle cx={22} cy={26} r={5} fill="#06140C" />
            <Circle cx={40} cy={26} r={5} fill="#06140C" />
            <Path
              d="M17 36 Q31 50 45 36"
              stroke="#06140C"
              strokeWidth={5.5}
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
        </Animated.View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ slide 2: rank */

function RankPreview({ active }: PreviewProps): React.ReactElement {
  const theme = useTheme();
  const compact = useCompact();

  return (
    <View className="flex-1 justify-center" style={{ opacity: active ? 1 : 0.98 }}>
      <Panel title="OPTIONS FOR YOUR GOAL" chip="SIDE BY SIDE">
        {RANKED_PREVIEW.map((row, index) => {
          const rc = RiskScale[row.riskLevel - 1] ?? theme.textTertiary;
          return (
            <View
              key={row.name}
              style={{
                paddingHorizontal: 10,
                paddingVertical: compact ? 7 : 9,
                borderRadius: Radius.md,
                backgroundColor: index % 2 === 0 ? theme.backgroundElement : 'transparent',
              }}>
              <View className="flex-row items-center" style={{ gap: 9 }}>
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
              </View>
            </View>
          );
        })}
      </Panel>
      <ThemedText style={{ fontSize: 10.5, color: theme.textTertiary, textAlign: 'center', marginTop: 10 }}>
        Chance · downside · cash required · time to payout
      </ThemedText>
    </View>
  );
}

/* ------------------------------------------------------------------ slide 3: breakdown */

function BreakdownPreview({ active }: PreviewProps): React.ReactElement {
  const theme = useTheme();
  const compact = useCompact();

  return (
    <View className="flex-1 justify-center" style={{ opacity: active ? 1 : 0.98 }}>
      <Panel title="ROUTE FACTS · VOO" chip="SOURCE-LINKED">
        <View className="flex-row items-center justify-between" style={{ paddingHorizontal: 10, paddingBottom: 2 }}>
          <View>
            <ThemedText style={{ fontSize: 11, color: theme.textSecondary }}>S&P 500 ETF</ThemedText>
            <ThemedText style={{ fontSize: 18, fontWeight: '900', color: theme.text }}>VOO</ThemedText>
          </View>
          <ThemedText style={{ fontSize: 10, fontWeight: '800', color: Brand[500] }}>LIVE QUOTE</ThemedText>
        </View>

        <View style={{ height: 1, backgroundColor: theme.border, marginHorizontal: 2 }} />

        {BREAKDOWN_FACTORS.map((factor) => (
          <View key={factor.label} style={{ paddingHorizontal: 10, paddingVertical: 5 }}>
            <View className="flex-row items-center justify-between">
              <ThemedText style={{ fontSize: 11.5, fontWeight: '600', color: theme.textSecondary }}>{factor.label}</ThemedText>
              <ThemedText style={{ fontSize: 11.5, fontWeight: '800', color: theme.text }}>
                {factor.value}
              </ThemedText>
            </View>
          </View>
        ))}

        <View style={{ height: 1, backgroundColor: theme.border, marginHorizontal: 2 }} />

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
              EXAMPLE OPTION
            </ThemedText>
            <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.text }} numberOfLines={1}>
              VOO · S&P 500 ETF
            </ThemedText>
          </View>
          <ThemedText style={{ fontSize: 12, fontWeight: '900', color: Brand[500] }}>View →</ThemedText>
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
      return <ScanHero key={key} active={active} />;
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
