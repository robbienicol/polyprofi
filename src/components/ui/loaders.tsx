import React, { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ANALYZE_STAGES = [
  'Reading live market data…',
  'Modeling outcome probabilities…',
  'Running EV & Kelly calculations…',
  'Pricing risk across markets…',
  'Filtering low-edge plays…',
  'Stress-testing each pick…',
  'Ranking your best routes…',
] as const;

/**
 * Full-screen "the algorithm is thinking" loader. Cycles through analysis stages
 * with a progress bar that creeps to ~95% — sells the depth of work happening.
 */
export function AnalyzingLoader(): React.ReactElement {
  const theme = useTheme();
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

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    const id = setInterval(() => {
      setStage((s) => (s < ANALYZE_STAGES.length - 1 ? s + 1 : s));
    }, 950);
    return () => clearInterval(id);
  }, [progress, pulse]);

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
        <Animated.View
          style={{
            width: 72, height: 72, borderRadius: Radius.xl, backgroundColor: Brand[500],
            alignItems: 'center', justifyContent: 'center', transform: [{ scale }], ...Shadow.float,
          }}>
          <ThemedText style={{ fontSize: 38, fontWeight: '900', color: '#06140C' }}>$</ThemedText>
        </Animated.View>
      </View>

      <View style={{ alignItems: 'center', gap: 8 }}>
        <ThemedText style={{ fontSize: 18, fontWeight: '800', color: theme.text, letterSpacing: -0.3 }}>
          Building your routes
        </ThemedText>
        <ThemedText style={{ fontSize: 13, color: Brand[500], fontWeight: '600', textAlign: 'center', minHeight: 18 }}>
          {ANALYZE_STAGES[stage]}
        </ThemedText>
      </View>

      <View style={{ width: '100%', maxWidth: 280, gap: 8 }}>
        <View style={{ height: 6, borderRadius: Radius.pill, backgroundColor: theme.backgroundSelected, overflow: 'hidden' }}>
          <Animated.View style={{ height: '100%', width, borderRadius: Radius.pill, backgroundColor: Brand[500] }} />
        </View>
        <ThemedText style={{ fontSize: 11, color: theme.textTertiary, textAlign: 'center' }}>
          Analysing thousands of data points in real time
        </ThemedText>
      </View>
    </View>
  );
}

/** Branded full-screen loader with a pulsing logo mark. Used at boot + route generation. */
export function BrandLoader({
  title = 'PolyProfit',
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}): React.ReactElement {
  const theme = useTheme();
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

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
        <Animated.View
          style={{
            width: 72,
            height: 72,
            borderRadius: Radius.xl,
            backgroundColor: Brand[500],
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale }],
          }}>
          <Animated.Text style={{ fontSize: 38, fontWeight: '900', color: '#06140C' }}>$</Animated.Text>
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
