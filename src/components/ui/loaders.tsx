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
