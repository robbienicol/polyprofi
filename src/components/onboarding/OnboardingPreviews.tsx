import React, { useEffect, useState } from "react";
import { Animated, Easing, View, useWindowDimensions } from "react-native";
import { Sparkles, type LucideIcon } from "lucide-react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";

import {
  BREAKDOWN_FACTORS,
  COACH_SCRIPT,
  MATH_DISCLAIMER,
  OnboardingSlide,
  RANKED_PREVIEW,
  SCORE_FACTORS,
  SWEEP_MARKETS,
} from "@/components/onboarding/onboarding-data";
import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/ui/Icon";
import { Brand, OnBrand, Semantic } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export { OnboardingGlow } from "@/components/onboarding/OnboardingGlow";

const MONO = { fontVariant: ["tabular-nums" as const] };

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

/*
 * Every slide is an illustration, never a mock of a control. Earlier versions drew
 * framed panels of bordered rows, drag handles, chips and a Send button — a slice of
 * UI on a screen where nothing can be touched, so people tried to touch it. The
 * shared vocabulary now: soft orange marks with line icons, a dotted spine that
 * ties them together, plain text beside them, and one quiet caption underneath.
 */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** A soft round mark holding a line icon. `strength` 0–1 sets how strongly it is tinted. */
function Mark({
  glyph,
  icon,
  size,
  strength = 0.2,
  color = Brand[500],
  muted = false,
}: {
  glyph?: string;
  icon?: LucideIcon;
  size: number;
  strength?: number;
  color?: string;
  muted?: boolean;
}): React.ReactElement {
  const theme = useTheme();
  const alpha = Math.round(Math.min(1, Math.max(0, strength)) * 255)
    .toString(16)
    .padStart(2, "0");
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.background,
      }}
    >
      <View
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 999,
          backgroundColor: muted ? theme.backgroundSelected : color + alpha,
        }}
      />
      <Icon
        glyph={glyph}
        icon={icon}
        size={Math.round(size * 0.42)}
        color={muted ? theme.textTertiary : color}
        strokeWidth={1.75}
      />
    </View>
  );
}

/** The dotted line a column of marks hangs on, from the first row's centre to the last's. */
function Spine({
  rows,
  rowHeight,
  rail,
}: {
  rows: number;
  rowHeight: number;
  rail: number;
}): React.ReactElement {
  return (
    <Svg
      width={rail}
      height={rowHeight * rows}
      style={{ position: "absolute", left: 0, top: 0 }}
      pointerEvents="none"
    >
      <Line
        x1={rail / 2}
        y1={rowHeight / 2}
        x2={rail / 2}
        y2={rowHeight * (rows - 1) + rowHeight / 2}
        stroke={Brand[500]}
        strokeOpacity={0.35}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="0.1 6"
      />
    </Svg>
  );
}

/** Label over a one- or two-line explanation — the text beside every mark. */
function MarkText({
  title,
  note,
  lead,
}: {
  title: string;
  note?: string;
  lead?: string;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <View className="flex-1" style={{ gap: 2 }}>
      <ThemedText
        style={{ fontSize: 14, fontWeight: "800", color: theme.text }}
        numberOfLines={1}
      >
        {lead ? (
          <ThemedText style={{ color: Brand[500], ...MONO }}>
            {lead}
            {"  "}
          </ThemedText>
        ) : null}
        {title}
      </ThemedText>
      {note ? (
        <ThemedText
          style={{ fontSize: 12, lineHeight: 16, color: theme.textSecondary }}
          numberOfLines={2}
        >
          {note}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** The one quiet line under an illustration. */
function Caption({ children }: { children: React.ReactNode }): React.ReactElement {
  const theme = useTheme();
  return (
    <ThemedText
      style={{
        fontSize: 11.5,
        lineHeight: 16,
        color: theme.textTertiary,
        textAlign: "center",
        marginTop: 14,
        paddingHorizontal: 12,
      }}
    >
      {children}
    </ThemedText>
  );
}

/** A score drawn as a ring filling to its value, the number in the middle. */
function ScoreRing({
  score,
  size,
  stroke,
  color = Brand[500],
  animate = false,
  fontSize,
}: {
  score: number;
  size: number;
  stroke: number;
  color?: string;
  animate?: boolean;
  fontSize: number;
}): React.ReactElement {
  const theme = useTheme();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const target = circumference * (1 - score / 100);
  const [offset] = useState(() => new Animated.Value(animate ? circumference : target));

  useEffect(() => {
    if (!animate) return;
    const animation = Animated.timing(offset, {
      toValue: target,
      duration: 900,
      delay: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [animate, offset, target]);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.backgroundSelected}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <ThemedText style={{ fontSize, fontWeight: "900", color: theme.text, ...MONO }}>
        {score}
      </ThemedText>
    </View>
  );
}

/** Fades + lifts its children in once on mount. Used for the scripted coach exchange. */
function FadeIn({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}): React.ReactElement {
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
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [10, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** The score factors heaviest first — the order they actually count in, by default. */
const FACTORS_BY_WEIGHT = [...SCORE_FACTORS].sort((a, b) => b.weight - a.weight);

/* ------------------------------------------------------------------ slide 0a: quiz */

/**
 * The four things a score weighs, as a ladder of shrinking marks, so the size
 * itself says "first counts most".
 */
function QuizPreview({ active }: PreviewProps): React.ReactElement {
  const compact = useCompact();
  const rowHeight = compact ? 58 : 66;
  const rail = 64;
  const sizes = [52, 44, 37, 31];
  const strengths = [0.2, 0.15, 0.11, 0.08];

  return (
    <View className="flex-1 justify-center" style={{ opacity: active ? 1 : 0.98, paddingHorizontal: 6 }}>
      <View>
        <Spine rows={FACTORS_BY_WEIGHT.length} rowHeight={rowHeight} rail={rail} />
        {FACTORS_BY_WEIGHT.map((factor, index) => (
          <View key={factor.label} className="flex-row items-center" style={{ height: rowHeight, gap: 14 }}>
            <View style={{ width: rail, alignItems: "center" }}>
              <Mark glyph={factor.emoji} size={sizes[index] ?? 30} strength={strengths[index]} />
            </View>
            <MarkText lead={String(index + 1)} title={factor.label} note={factor.note} />
          </View>
        ))}
      </View>
      <Caption>
        Every route is scored on these four, and the ones at the top count the most. You can change the order anytime in Settings.
      </Caption>
    </View>
  );
}

/* ------------------------------------------------------------------ slide 0b: score */

/**
 * Four things in, one number out: the factors drawn across the top, dotted lines
 * running down into a ring that fills to the score. The percentages are the real
 * default weights (`DEFAULT_SCORE_WEIGHTS` in src/lib/score.ts).
 */
function ScorePreview({ active }: PreviewProps): React.ReactElement {
  const theme = useTheme();
  const compact = useCompact();
  const width = 288;
  const spacing = 72;
  const markSize = compact ? 40 : 44;
  const markY = markSize / 2;
  const ringSize = compact ? 104 : 118;
  const linesTop = markSize + 30;
  const ringTop = linesTop + (compact ? 44 : 56);
  const height = ringTop + ringSize;
  const xs = FACTORS_BY_WEIGHT.map((_, index) => width / 2 - spacing * 1.5 + spacing * index);

  return (
    <View className="flex-1 justify-center items-center" style={{ opacity: active ? 1 : 0.98 }}>
      <View style={{ width, height }}>
        <Svg width={width} height={height} style={{ position: "absolute" }} pointerEvents="none">
          {xs.map((x) => (
            <Path
              key={x}
              d={`M${x},${linesTop} Q${x},${ringTop - 12} ${width / 2},${ringTop - 4}`}
              stroke={Brand[500]}
              strokeOpacity={0.35}
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray="0.1 6"
              fill="none"
            />
          ))}
        </Svg>

        {FACTORS_BY_WEIGHT.map((factor, index) => (
          <View
            key={factor.label}
            style={{ position: "absolute", left: xs[index] - 40, top: markY - markSize / 2, width: 80, alignItems: "center", gap: 5 }}
          >
            <Mark glyph={factor.emoji} size={markSize} strength={0.18} />
            <ThemedText style={{ fontSize: 12, fontWeight: "900", color: Brand[500], ...MONO }}>
              {factor.weight}%
            </ThemedText>
          </View>
        ))}

        <View style={{ position: "absolute", top: ringTop, left: width / 2 - ringSize / 2, alignItems: "center" }}>
          <ScoreRing score={82} size={ringSize} stroke={9} animate={active} fontSize={compact ? 32 : 36} />
        </View>
        <ThemedText
          style={{
            position: "absolute",
            top: ringTop + ringSize / 2 + (compact ? 18 : 21),
            width,
            textAlign: "center",
            fontSize: 10.5,
            fontWeight: "800",
            color: theme.textTertiary,
          }}
        >
          out of 100
        </ThemedText>
      </View>
      <Caption>
        Chance it works, money you need, what you could lose and how long it takes, blended into one 0–100 score — the same scale for a card switch, a stock or a bet.
      </Caption>
    </View>
  );
}

/* ------------------------------------------------------------------ slide 1: sweep */

/** How long the check takes to travel from one way to the next. */
const SWEEP_STEP_MS = 520;
/** Extra steps spent on the finished list before the check starts over. */
const SWEEP_HOLD_STEPS = 4;

/**
 * The sweep, shown rather than described: a line fills down the spine and each
 * mark lights and ticks as it arrives, then the whole thing loops.
 *
 * Driven by a plain interval over an integer step rather than by Animated's own
 * looping — Animated loops parked after one pass here (a timing nested in a
 * sequence ignores `resetBeforeIteration`), and a counter that wraps cannot stick.
 *
 * No prices or counts: a number here would read as a claim about what the app
 * found today, and nothing on this screen is live.
 */
function SweepPreview({ active }: PreviewProps): React.ReactElement {
  const compact = useCompact();
  const total = SWEEP_MARKETS.length + SWEEP_HOLD_STEPS;
  const [step, setStep] = useState(0);
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setStep((current) => (current + 1) % total), SWEEP_STEP_MS);
    return () => clearInterval(id);
  }, [active, total]);

  const reached = Math.min(step, SWEEP_MARKETS.length);
  useEffect(() => {
    // Filling down glides; the wrap back to the top is instant.
    Animated.timing(progress, {
      toValue: reached,
      duration: reached === 0 ? 0 : SWEEP_STEP_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [progress, reached]);

  const rowHeight = compact ? 52 : 60;
  const rail = 56;
  const count = SWEEP_MARKETS.length;
  const done = step >= count;

  return (
    <View className="flex-1 justify-center" style={{ opacity: active ? 1 : 0.98, paddingHorizontal: 6 }}>
      <View>
        <Spine rows={count} rowHeight={rowHeight} rail={rail} />
        {/* The solid line that fills the spine as each way is checked. */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: rail / 2 - 1,
            top: rowHeight / 2,
            width: 2,
            borderRadius: 1,
            backgroundColor: Brand[500],
            height: progress.interpolate({
              inputRange: [0, 1, count],
              outputRange: [0, 0, rowHeight * (count - 1)],
            }),
          }}
        />
        {SWEEP_MARKETS.map((market, index) => (
          <SweepRow key={market.label} market={market} lit={step > index} height={rowHeight} rail={rail} />
        ))}
      </View>
      <Caption>
        {done
          ? `All ${count} ways checked for your goal, at once.`
          : `Checking ${Math.min(step + 1, count)} of ${count} ways…`}
      </Caption>
    </View>
  );
}

/** One way in the sweep: a muted mark until the check reaches it, then lit with a tick. */
function SweepRow({
  market,
  lit,
  height,
  rail,
}: {
  market: (typeof SWEEP_MARKETS)[number];
  lit: boolean;
  height: number;
  rail: number;
}): React.ReactElement {
  const theme = useTheme();
  const [anim] = useState(() => new Animated.Value(lit ? 1 : 0));

  useEffect(() => {
    Animated.timing(anim, {
      toValue: lit ? 1 : 0,
      duration: lit ? 240 : 0,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim, lit]);

  return (
    <View className="flex-row items-center" style={{ height, gap: 14 }}>
      <View style={{ width: rail, alignItems: "center" }}>
        <Mark glyph={market.emoji} size={42} strength={0.2} muted={!lit} />
        <Animated.View
          style={{
            position: "absolute",
            right: rail / 2 - 24,
            bottom: -2,
            width: 18,
            height: 18,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: Brand[500],
            borderWidth: 2,
            borderColor: theme.background,
            opacity: anim,
            transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
          }}
        >
          <Icon glyph="✓" size={10} color={OnBrand} strokeWidth={3.2} />
        </Animated.View>
      </View>
      <View className="flex-1" style={{ gap: 2 }}>
        <Animated.Text
          numberOfLines={1}
          style={{
            fontSize: 14,
            fontWeight: "800",
            color: anim.interpolate({ inputRange: [0, 1], outputRange: [theme.textTertiary, theme.text] }),
          }}
        >
          {market.label}
        </Animated.Text>
        <ThemedText style={{ fontSize: 12, color: theme.textSecondary }} numberOfLines={1}>
          {market.note}
        </ThemedText>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ slide 2: rank */

// Same good / fair / poor bands as the real route card's score badge.
const scoreColor = (score: number): string =>
  score >= 75 ? Semantic.positive : score >= 50 ? Semantic.caution : Semantic.negative;

/**
 * One board for everything: each option as a mark on the spine with its score as
 * a small ring, highest first — so a spending cut sitting above a stock is
 * something you see rather than read.
 */
function RankPreview({ active }: PreviewProps): React.ReactElement {
  const compact = useCompact();
  const rowHeight = compact ? 52 : 60;
  const rail = 56;

  return (
    <View className="flex-1 justify-center" style={{ opacity: active ? 1 : 0.98, paddingHorizontal: 6 }}>
      <View>
        <Spine rows={RANKED_PREVIEW.length} rowHeight={rowHeight} rail={rail} />
        {RANKED_PREVIEW.map((row, index) => (
          <View key={row.name} className="flex-row items-center" style={{ height: rowHeight, gap: 14 }}>
            <View style={{ width: rail, alignItems: "center" }}>
              <Mark glyph={row.emoji} size={42} strength={0.2 - index * 0.025} />
            </View>
            <MarkText
              title={row.name}
              note={row.guaranteed ? row.note : `${row.platform} · ${row.note}`}
            />
            <ScoreRing score={row.score} size={40} stroke={3.5} color={scoreColor(row.score)} fontSize={13} />
          </View>
        ))}
      </View>
      <Caption>
        Spending smarter, saving and investing on the same board, best score first. Using the right card can outrank a stock.
      </Caption>
    </View>
  );
}

/* ------------------------------------------------------------------ slide 3: breakdown */

/**
 * What opening a pick shows: the pick itself, then each fact behind its score on
 * the spine, and what happens if it goes wrong — nothing kept back.
 */
function BreakdownPreview({ active }: PreviewProps): React.ReactElement {
  const theme = useTheme();
  const compact = useCompact();
  const rowHeight = compact ? 46 : 52;
  const rail = 56;

  return (
    <View className="flex-1 justify-center" style={{ opacity: active ? 1 : 0.98, paddingHorizontal: 6 }}>
      <View className="flex-row items-center" style={{ gap: 14, marginBottom: 12 }}>
        <View style={{ width: rail, alignItems: "center" }}>
          <Mark glyph="📈" size={54} strength={0.22} />
        </View>
        <View className="flex-1">
          <ThemedText style={{ fontSize: 22, fontWeight: "900", color: theme.text, letterSpacing: -0.4 }}>VOO</ThemedText>
          <ThemedText style={{ fontSize: 12, color: theme.textSecondary }}>A fund that owns the S&amp;P 500</ThemedText>
        </View>
      </View>

      <View>
        <Spine rows={BREAKDOWN_FACTORS.length} rowHeight={rowHeight} rail={rail} />
        {BREAKDOWN_FACTORS.map((factor) => (
          <View key={factor.label} className="flex-row items-center" style={{ height: rowHeight, gap: 14 }}>
            <View style={{ width: rail, alignItems: "center" }}>
              <Mark glyph={factor.emoji} size={34} strength={0.14} />
            </View>
            <ThemedText style={{ flex: 1, fontSize: 13, color: theme.textSecondary }} numberOfLines={1}>
              {factor.label}
            </ThemedText>
            <ThemedText style={{ fontSize: 14, fontWeight: "800", color: theme.text, ...MONO }} numberOfLines={1}>
              {factor.value}
            </ThemedText>
          </View>
        ))}
      </View>

      {compact ? null : (
        <View className="flex-row items-start" style={{ gap: 14, marginTop: 10 }}>
          <View style={{ width: rail, alignItems: "center" }}>
            <Mark glyph="⚠️" size={34} strength={0.16} color={Semantic.caution} />
          </View>
          <ThemedText style={{ flex: 1, fontSize: 12, lineHeight: 17, color: theme.textSecondary, paddingTop: 1 }}>
            <ThemedText style={{ fontWeight: "800", color: theme.text }}>If it goes against you: </ThemedText>
            the fund drops for a while, but it doesn&apos;t go to zero. Picks that can lose everything say so right here.
          </ThemedText>
        </View>
      )}
      <Caption>Every number shows where it came from and when it was checked.</Caption>
    </View>
  );
}

/* ------------------------------------------------------------------ slide 4: coach */

function TypingDots(): React.ReactElement {
  const theme = useTheme();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: 1050, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  return (
    <View
      className="flex-row items-center"
      style={{
        alignSelf: "flex-start",
        gap: 4,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 18,
        backgroundColor: theme.backgroundSelected,
      }}
    >
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

/**
 * The coach, as a short scripted exchange about one pick. Just the two bubbles and
 * the coach's mark — no input bar, no Send button, no tappable starter chips, since
 * none of them would do anything here.
 */
function CoachPreview({ active }: PreviewProps): React.ReactElement {
  const theme = useTheme();
  const compact = useCompact();
  // 0: nothing yet · 1: question · 2: coach typing · 3: answer (rests here)
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!active || stage >= 3) return;
    const timer = setTimeout(() => setStage(stage + 1), [600, 600, 1300][stage]);
    return () => clearTimeout(timer);
  }, [active, stage]);

  const [question, answer] = COACH_SCRIPT;

  return (
    <View className="flex-1 justify-center" style={{ paddingHorizontal: 6 }}>
      <View className="flex-row items-center" style={{ gap: 12, marginBottom: 16 }}>
        <Mark icon={Sparkles} size={44} strength={0.2} />
        <View className="flex-1">
          <ThemedText style={{ fontSize: 14, fontWeight: "800", color: theme.text }}>Your AI coach</ThemedText>
          <ThemedText style={{ fontSize: 12, color: theme.textSecondary }}>Looking at VOO, scored 82</ThemedText>
        </View>
      </View>

      <View style={{ gap: 10, minHeight: compact ? 150 : 176, justifyContent: "flex-start" }}>
        {stage >= 1 ? (
          <FadeIn>
            <View
              style={{
                alignSelf: "flex-end",
                maxWidth: "84%",
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 18,
                borderBottomRightRadius: 6,
                backgroundColor: Brand[500] + "24",
              }}
            >
              <ThemedText style={{ fontSize: 13, fontWeight: "700", color: theme.text, lineHeight: 18 }}>
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
                alignSelf: "flex-start",
                maxWidth: "92%",
                paddingHorizontal: 14,
                paddingVertical: 11,
                borderRadius: 18,
                borderBottomLeftRadius: 6,
                backgroundColor: theme.backgroundSelected,
              }}
            >
              <ThemedText style={{ fontSize: 13, color: theme.text, lineHeight: 19 }}>{answer.text}</ThemedText>
            </View>
          </FadeIn>
        ) : null}
      </View>
      <Caption>Ask about any pick, in plain English, any time.</Caption>
    </View>
  );
}

/* ------------------------------------------------------------------ slide 6: math */

/**
 * The formula, written out: the four factors on the spine with the weight each is
 * multiplied by, then three plain lines on what the number is not.
 */
function MathPreview({ active }: PreviewProps): React.ReactElement {
  const theme = useTheme();
  const compact = useCompact();
  const rowHeight = compact ? 44 : 50;
  const rail = 56;

  return (
    <View className="flex-1 justify-center" style={{ opacity: active ? 1 : 0.98, paddingHorizontal: 6 }}>
      <ThemedText style={{ fontSize: 22, fontWeight: "900", color: theme.text, marginBottom: 6, marginLeft: 4, ...MONO }}>
        Score =
      </ThemedText>
      <View>
        <Spine rows={FACTORS_BY_WEIGHT.length} rowHeight={rowHeight} rail={rail} />
        {FACTORS_BY_WEIGHT.map((factor) => (
          <View key={factor.label} className="flex-row items-center" style={{ height: rowHeight, gap: 14 }}>
            <View style={{ width: rail, alignItems: "center" }}>
              <Mark glyph={factor.emoji} size={36} strength={0.16} />
            </View>
            <ThemedText style={{ flex: 1, fontSize: 14, fontWeight: "700", color: theme.text }} numberOfLines={1}>
              {factor.label}
            </ThemedText>
            <ThemedText style={{ fontSize: 14, fontWeight: "900", color: Brand[500], ...MONO }}>
              × {(factor.weight / 100).toFixed(2)}
            </ThemedText>
          </View>
        ))}
      </View>

      <View style={{ gap: 8, marginTop: 16, paddingHorizontal: 4 }}>
        {MATH_DISCLAIMER.map((line) => (
          <View key={line} className="flex-row items-start" style={{ gap: 10 }}>
            <View style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: Brand[500], opacity: 0.5, marginTop: 7 }} />
            <ThemedText style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: theme.textSecondary }}>{line}</ThemedText>
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
export function renderOnboardingPreview(
  kind: OnboardingSlide["kind"],
  active: boolean,
): React.ReactElement {
  const key = active ? "active" : "idle";
  switch (kind) {
    case "quiz":
      return <QuizPreview key={key} active={active} />;
    case "score":
      return <ScorePreview key={key} active={active} />;
    case "scan":
      return <SweepPreview key={key} active={active} />;
    case "rank":
      return <RankPreview key={key} active={active} />;
    case "breakdown":
      return <BreakdownPreview key={key} active={active} />;
    case "coach":
      return <CoachPreview key={key} active={active} />;
    case "math":
      return <MathPreview key={key} active={active} />;
    // The hero, consent, and name slides draw themselves end to end.
    default:
      return <View className="flex-1" />;
  }
}
