import React, { useEffect, useState } from 'react';
import { Animated, Easing, useWindowDimensions, View } from 'react-native';

import {
  BREAKDOWN_FACTORS,
  CLOSING_PROOF,
  COACH_SCRIPT,
  COACH_STARTERS,
  OnboardingSlide,
  RANKED_PREVIEW,
  SWEEP_MARKETS,
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

/* ------------------------------------------------------------------ slide 1: sweep */

/** How long the beam takes to travel from one market to the next. */
const SWEEP_STEP_MS = 520;
/** Extra steps spent on the finished list before the beam starts over. */
const SWEEP_HOLD_STEPS = 4;

/**
 * The sweep, shown rather than described.
 *
 * A beam travels down a list of every market Pathey prices, and each row lights
 * up and gets a tick as the beam reaches it — so "we check every way to grow
 * your money" is a thing you watch happen instead of a claim you read. It loops,
 * because the first pass is over before most people have finished the headline.
 *
 * Driven by a plain interval over an integer step rather than by Animated's own
 * looping. Three different Animated loop shapes each ran exactly one pass here
 * and then parked — `resetBeforeIteration` does not reach a timing nested in a
 * sequence, a zero-duration rewind ends the loop instead of restarting it, and
 * rescheduling from the `start()` callback never fired a second time. A counter
 * that wraps cannot get stuck, and the beam just follows wherever it points.
 *
 * No prices or counts anywhere in it: a number here would read as a claim about
 * what the app found today, and nothing on this screen is live.
 */
function SweepPreview({ active }: PreviewProps): React.ReactElement {
  const theme = useTheme();
  const compact = useCompact();
  const total = SWEEP_MARKETS.length + SWEEP_HOLD_STEPS;
  const [step, setStep] = useState(0);
  // Follows `step`, so the beam glides between rows instead of jumping.
  const [beam] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setStep((current) => (current + 1) % total), SWEEP_STEP_MS);
    return () => clearInterval(id);
  }, [active, total]);

  const beamRow = Math.min(step, SWEEP_MARKETS.length);
  useEffect(() => {
    // The wrap back to the top is instant; every other move is a glide, so the
    // beam never appears to travel back up through the list it just checked.
    Animated.timing(beam, {
      toValue: beamRow,
      duration: beamRow === 0 ? 0 : SWEEP_STEP_MS,
      easing: Easing.inOut(Easing.quad),
      // Row heights are laid out, not transformed, so this drives a translate
      // measured in laid-out pixels and cannot run on the native driver.
      useNativeDriver: false,
    }).start();
  }, [beam, beamRow]);

  const rowHeight = compact ? 44 : 50;
  const done = step >= SWEEP_MARKETS.length;

  return (
    <View className="flex-1 justify-center" style={{ opacity: active ? 1 : 0.98 }}>
      <Panel title="CHECKING EVERY MARKET" chip={done ? 'DONE' : 'LIVE'}>
        <View>
          {/* The beam. Sits behind the rows and slides down with the step, so
              what lights a row and what moves the light are one clock. */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: -12,
              right: -12,
              height: rowHeight,
              borderRadius: Radius.md,
              backgroundColor: Brand[500] + '1F',
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: Brand[500] + '4D',
              // Fades out once it has run off the end of the list.
              opacity: done ? 0 : 1,
              transform: [
                {
                  translateY: beam.interpolate({
                    inputRange: [0, SWEEP_MARKETS.length],
                    outputRange: [0, rowHeight * SWEEP_MARKETS.length],
                  }),
                },
              ],
            }}
          />

          {SWEEP_MARKETS.map((market, index) => (
            <SweepRow key={market.label} market={market} lit={step > index} height={rowHeight} />
          ))}
        </View>
      </Panel>

      <ThemedText style={{ fontSize: 10.5, color: theme.textTertiary, textAlign: 'center', marginTop: 10 }}>
        {done
          ? `All ${SWEEP_MARKETS.length} markets checked · ranked safest first`
          : `Checked ${step} of ${SWEEP_MARKETS.length} markets…`}
      </ThemedText>
    </View>
  );
}

/** One market in the sweep. Greys out until the beam reaches it, then ticks. */
function SweepRow({
  market,
  lit,
  height,
}: {
  market: (typeof SWEEP_MARKETS)[number];
  lit: boolean;
  height: number;
}): React.ReactElement {
  const theme = useTheme();
  const [anim] = useState(() => new Animated.Value(lit ? 1 : 0));

  useEffect(() => {
    Animated.timing(anim, {
      toValue: lit ? 1 : 0,
      // The tick lands promptly; clearing on the wrap is instant, so the list
      // empties in one frame rather than fading out row by row.
      duration: lit ? 240 : 0,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim, lit]);

  return (
    <View className="flex-row items-center" style={{ height, gap: 10 }}>
      <ThemedText style={{ fontSize: 15 }}>{market.emoji}</ThemedText>
      <View style={{ flex: 1 }}>
        <Animated.Text
          numberOfLines={1}
          style={{
            fontSize: 12.5,
            fontWeight: '700',
            color: anim.interpolate({ inputRange: [0, 1], outputRange: [theme.textTertiary, theme.text] }),
          }}>
          {market.label}
        </Animated.Text>
        <ThemedText style={{ fontSize: 10, color: theme.textTertiary }} numberOfLines={1}>
          {market.note}
        </ThemedText>
      </View>

      {/* The tick pops in on the beam. Scale rather than a fade alone, so it
          reads as something completing rather than something appearing. */}
      <Animated.View
        style={{
          width: 20,
          height: 20,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: Brand[500],
          opacity: anim,
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
        }}>
        <ThemedText style={{ fontSize: 11, fontWeight: '900', color: '#06140C' }}>✓</ThemedText>
      </Animated.View>
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
        Chance · downside · cash required · time to resolve
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
      return <SweepPreview key={key} active={active} />;
    case 'rank':
      return <RankPreview key={key} active={active} />;
    case 'breakdown':
      return <BreakdownPreview key={key} active={active} />;
    case 'coach':
      return <CoachPreview key={key} active={active} />;
    case 'close':
      return <ClosePreview />;
    // The hero, consent, and name slides draw themselves end to end.
    default:
      return <View className="flex-1" />;
  }
}
