import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';

import { BrandMark } from '@/components/ui/BrandMark';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Shadow } from '@/constants/theme';
import { useSemanticText, useTheme } from '@/hooks/use-theme';

/**
 * Whether the user has asked the system to cut motion down. Both loaders run an
 * infinite pulse, which is exactly the kind of animation Reduce Motion exists to
 * stop; they hold a still mark instead when it is on.
 */
function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (alive) setReduce(value); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => { alive = false; sub.remove(); };
  }, []);
  return reduce;
}

/** Corner radius of a 72pt mark tile — matches the rounding BrandMark draws. */
const MARK_RADIUS = 72 * 0.2237;

/*
 * What the wait is actually doing, in the order it does it.
 *
 * The old stages named "plays" and "each pick" — the vocabulary of a tout, and the
 * one word the product's own terminology bans. They also claimed work nobody could
 * check ("Analysing thousands of data points in real time"). These name the steps
 * the engine really runs, in the language the rest of the app uses.
 */
const ANALYZE_STAGES = [
  'Reading live market data…',
  'Stripping the bookmaker margin…',
  'Pricing the chance of each outcome…',
  'Costing every route against your goal…',
  'Dropping the ones that lose on average…',
  'Ranking them, safest first…',
] as const;

/**
 * Full-screen loader for a new search. The bar reports elapsed time against the
 * search's own budget and stops at 95%; it is a wait indicator, not a claim about
 * how much work is done, and the line under it says so rather than selling depth.
 */
export function AnalyzingLoader(): React.ReactElement {
  const theme = useTheme();
  const semantic = useSemanticText();
  const reduceMotion = useReduceMotion();
  const [stage, setStage] = useState(0);
  const [progress] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 0.95,
      duration: ANALYZE_STAGES.length * 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    const loop = reduceMotion ? null : Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop?.start();

    const id = setInterval(() => {
      setStage((s) => (s < ANALYZE_STAGES.length - 1 ? s + 1 : s));
    }, 950);
    return () => { clearInterval(id); loop?.stop(); };
  }, [progress, pulse, reduceMotion]);

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background, paddingHorizontal: 40, gap: 28 }}>
      <View style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          style={{
            position: 'absolute', width: 72, height: 72, borderRadius: Radius.xl,
            borderWidth: 2, borderColor: Brand[500],
            transform: [{ scale: ringScale }], opacity: ringOpacity,
          }}
        />
        <Animated.View style={{ borderRadius: MARK_RADIUS, transform: [{ scale }], ...Shadow.float }}>
          <BrandMark size={72} />
        </Animated.View>
      </View>

      <View style={{ alignItems: 'center', gap: 8 }}>
        <ThemedText style={{ fontSize: 18, fontWeight: '800', color: theme.text, letterSpacing: -0.3 }}>
          Building your routes
        </ThemedText>
        <ThemedText
          accessibilityLiveRegion="polite"
          style={{ fontSize: 14, color: semantic.brand, fontWeight: '600', textAlign: 'center', minHeight: 20 }}>
          {ANALYZE_STAGES[stage]}
        </ThemedText>
      </View>

      <View style={{ width: '100%', maxWidth: 280, gap: 8 }}>
        <View style={{ height: 6, borderRadius: Radius.pill, backgroundColor: theme.borderControl, overflow: 'hidden' }}>
          <Animated.View style={{ height: '100%', width, borderRadius: Radius.pill, backgroundColor: Brand[500] }} />
        </View>
        <ThemedText style={{ fontSize: 12, color: theme.textSecondary, textAlign: 'center', lineHeight: 17 }}>
          Ten live sources — sportsbooks, prediction markets, funds, coins and rates.
        </ThemedText>
      </View>
    </View>
  );
}

/** Branded full-screen loader with a pulsing logo mark. Used at boot + route generation. */
export function BrandLoader({
  title = 'Pathey',
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}): React.ReactElement {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background, gap: 24 }}>
      <View style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }}>
        {/* expanding ring */}
        <Animated.View
          style={{
            position: 'absolute',
            width: 72,
            height: 72,
            borderRadius: Radius.xl,
            borderWidth: 2,
            borderColor: Brand[500],
            transform: [{ scale: ringScale }],
            opacity: ringOpacity,
          }}
        />
        {/* logo mark */}
        <Animated.View style={{ borderRadius: MARK_RADIUS, transform: [{ scale }] }}>
          <BrandMark size={72} />
        </Animated.View>
      </View>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Animated.Text style={{ fontSize: 17, fontWeight: '800', color: theme.text, letterSpacing: -0.3 }}>
          {title}
        </Animated.Text>
        {!!subtitle && (
          <Animated.Text style={{ fontSize: 13, color: theme.textSecondary }}>{subtitle}</Animated.Text>
        )}
      </View>
    </View>
  );
}

/**
 * Grey blocks in the shape of what is loading, softly pulsing. Holds the layout so
 * nothing jumps when the real content lands; still under Reduce Motion.
 */
export function SkeletonBlocks({ heights = [72, 140] }: { heights?: number[] }): React.ReactElement {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const [opacity] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.5, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);
  return (
    <Animated.View style={{ gap: 12, opacity }} accessibilityLabel="Loading" accessible>
      {heights.map((height, index) => (
        <View key={index} style={{ height, borderRadius: Radius.lg, backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.border }} />
      ))}
    </Animated.View>
  );
}

/** The shared pulse for a group of bones, so a whole skeleton breathes as one. */
function usePulse(): Animated.Value {
  const reduceMotion = useReduceMotion();
  const [opacity] = useState(() => new Animated.Value(0.55));
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.55, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);
  return opacity;
}

/** One grey shape inside a skeleton. */
export function Bone({ width = '100%', height = 12, radius = 6, style }: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: React.ComponentProps<typeof View>['style'];
}): React.ReactElement {
  const theme = useTheme();
  return <View style={[{ width, height, borderRadius: radius, backgroundColor: theme.backgroundSelected }, style]} />;
}

/** Wraps bones in one pulse and one "Loading" for a screen reader. */
export function Skeleton({ children, style }: React.PropsWithChildren<{ style?: React.ComponentProps<typeof View>['style'] }>): React.ReactElement {
  const opacity = usePulse();
  return (
    <Animated.View style={[{ opacity }, style]} accessible accessibilityLabel="Loading">
      {children}
    </Animated.View>
  );
}

/** A route card's shape: header, two lines of copy, the profit and chart, the pill. */
export function RouteCardSkeleton(): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={{ borderRadius: Radius.xl, backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.border, padding: 16, gap: 14 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Bone width={36} height={36} radius={Radius.md} />
        <View style={{ flex: 1, gap: 7 }}>
          <Bone width="55%" height={13} />
          <Bone width="35%" height={10} />
        </View>
        <Bone width={52} height={20} radius={999} />
      </View>
      <View style={{ gap: 7 }}>
        <Bone height={11} />
        <Bone width="80%" height={11} />
      </View>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <View style={{ flex: 1, gap: 8 }}>
          <Bone width="45%" height={10} />
          <Bone width="60%" height={24} />
          <Bone width="50%" height={10} />
        </View>
        <Bone width="45%" height={56} radius={8} />
      </View>
      <Bone height={48} radius={999} />
    </View>
  );
}

/** The Routes screen before its routes exist: search, amounts, chips, two cards. */
export function RoutesScreenSkeleton(): React.ReactElement {
  return (
    <Skeleton style={{ gap: 12, padding: 16 }}>
      <Bone height={48} radius={999} />
      <Bone height={104} radius={Radius.xl} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Bone width={60} height={40} radius={999} />
        <Bone width={150} height={40} radius={999} />
        <Bone width={120} height={40} radius={999} />
      </View>
      <RouteCardSkeleton />
      <RouteCardSkeleton />
    </Skeleton>
  );
}

/** A route's detail screen: the summary card, the chart, the actions. */
export function RouteDetailSkeleton(): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Skeleton style={{ gap: 14, padding: 16, paddingTop: 72 }}>
        <Bone width="40%" height={18} style={{ alignSelf: 'center' }} />
        <Bone height={300} radius={Radius.xl} />
        <Bone height={240} radius={Radius.lg} />
        <Bone height={52} radius={Radius.lg} />
      </Skeleton>
    </View>
  );
}

/** Rows of a list, for a tab whose items are still being read off the device. */
export function ListRowsSkeleton({ rows = 3, height = 84 }: { rows?: number; height?: number }): React.ReactElement {
  return (
    <Skeleton style={{ gap: 10 }}>
      {Array.from({ length: rows }, (_, index) => <Bone key={index} height={height} radius={Radius.lg} />)}
    </Skeleton>
  );
}

/** Three lines of a reply being written. */
export function TextLinesSkeleton({ lines = 3 }: { lines?: number }): React.ReactElement {
  return (
    <Skeleton style={{ gap: 7 }}>
      {Array.from({ length: lines }, (_, index) => <Bone key={index} width={index === lines - 1 ? '60%' : '100%'} height={11} />)}
    </Skeleton>
  );
}
