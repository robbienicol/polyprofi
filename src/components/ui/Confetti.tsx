import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, useWindowDimensions, View } from 'react-native';

import { Accent, Brand } from '@/constants/theme';

const COLORS = [Brand[500], Brand[300], Brand[100], Accent.gold, Accent.blue, Accent.violet];

interface Piece {
  left: number; // fraction of screen width
  size: number;
  color: string;
  delay: number; // 0–1, folded into the shared driver so one animation runs the lot
  drift: number; // horizontal travel, px
  spins: number;
  round: boolean;
}

/**
 * Deterministic scatter. Each attribute walks the unit interval by its own
 * irrational step, so the pieces look randomly strewn while render stays pure —
 * Math.random() during render is both a lint error here and a source of pieces
 * that jump on every re-render.
 *
 * The steps must not be rationally related, or the attributes correlate and the
 * burst reads as a pattern: golden ratio (0.618) paired with 1 − golden ratio
 * (0.382) put every piece on one straight diagonal.
 */
const STEP = {
  left: 0.6180339887, // φ − 1
  size: 0.4142135624, // √2 − 1
  delay: 0.7320508076, // √3 − 1
  drift: 0.2360679775, // √5 − 2
  spins: 0.1415926536, // π − 3
} as const;

function scatter(index: number, step: number): number {
  return ((index + 1) * step) % 1;
}

/**
 * One Animated.Value drives every piece: each interpolates the same 0→1 progress
 * over its own delayed slice, so the whole burst costs a single native-driver
 * animation rather than one per piece. Reanimated is installed but has no babel
 * plugin configured in this project, so this uses the RN Animated API like the
 * rest of the app's motion (see @/components/ui/loaders).
 */
export function Confetti({
  count = 44,
  duration = 4200,
  waves = 2,
}: {
  count?: number;
  duration?: number;
  waves?: number;
}): React.ReactElement {
  const { width, height } = useWindowDimensions();
  const [progress] = useState(() => new Animated.Value(0));

  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: count }, (_, index) => ({
        left: scatter(index, STEP.left),
        size: 7 + scatter(index, STEP.size) * 9,
        color: COLORS[index % COLORS.length],
        delay: scatter(index, STEP.delay) * 0.45,
        drift: (scatter(index, STEP.drift) - 0.5) * 140,
        spins: 1 + scatter(index, STEP.spins) * 3,
        round: index % 3 === 0,
      })),
    [count],
  );

  useEffect(() => {
    const fall = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    const animation = waves > 1
      ? Animated.loop(Animated.sequence([fall, Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true })]), { iterations: waves })
      : fall;
    animation.start();
    return () => animation.stop();
  }, [duration, progress, waves]);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      {pieces.map((piece, index) => {
        // Each piece falls across its own window of the shared timeline.
        const start = piece.delay;
        const end = Math.min(1, start + 0.62);
        const range = { inputRange: [start, end], extrapolate: 'clamp' as const };
        return (
          <Animated.View
            key={index}
            style={{
              position: 'absolute',
              left: piece.left * width,
              width: piece.size,
              height: piece.round ? piece.size : piece.size * 0.45,
              borderRadius: piece.round ? piece.size : 1.5,
              backgroundColor: piece.color,
              opacity: progress.interpolate({
                inputRange: [start, start + 0.05, end - 0.12, end],
                outputRange: [0, 1, 1, 0],
                extrapolate: 'clamp',
              }),
              transform: [
                { translateY: progress.interpolate({ ...range, outputRange: [-40, height + 40] }) },
                { translateX: progress.interpolate({ ...range, outputRange: [0, piece.drift] }) },
                {
                  rotate: progress.interpolate({
                    ...range,
                    outputRange: ['0deg', `${Math.round(piece.spins * 360)}deg`],
                  }),
                },
              ],
            }}
          />
        );
      })}
    </View>
  );
}
