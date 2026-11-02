import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';

import { Brand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A row of work with its own bar.
 *
 * Each row fills on its own eased curve with a beat of dead air after it — a bar
 * that surges then settles reads as a task completing, where one constant-rate
 * sweep reads as a timer.
 */
export function TaskRow({
  label,
  progress,
  index,
}: {
  label: string;
  /** Animated 0 → tasks.length; this row reads the slice between index and index+1. */
  progress: Animated.Value;
  index: number;
}): React.ReactElement {
  const theme = useTheme();
  const fill = progress.interpolate({
    inputRange: [index, index + 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });
  const tint = progress.interpolate({
    inputRange: [index, index + 0.05],
    outputRange: [theme.textTertiary, theme.text],
    extrapolate: 'clamp',
  });

  return (
    <View style={{ gap: 7 }}>
      <Animated.Text style={{ fontSize: 13, fontWeight: '700', color: tint }}>{label}</Animated.Text>
      <View
        style={{
          height: 5,
          borderRadius: Radius.pill,
          backgroundColor: theme.backgroundSelected,
          overflow: 'hidden',
        }}>
        <Animated.View
          style={{ height: '100%', width: fill, borderRadius: Radius.pill, backgroundColor: Brand[500] }}
        />
      </View>
    </View>
  );
}

/**
 * Runs a set of task bars to completion and calls `onDone` once the last one
 * lands. Returns the driver so a caller can hang other timing off the same clock.
 */
export function useTaskProgress({
  count,
  fillMs,
  gapMs,
  tailMs,
  onDone,
}: {
  count: number;
  fillMs: number;
  gapMs: number;
  tailMs: number;
  onDone: () => void;
}): Animated.Value {
  const [progress] = useState(() => new Animated.Value(0));
  // Held in a ref so a fresh callback identity never restarts the run.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    progress.setValue(0);
    const steps = Array.from({ length: count }).flatMap((_, index) => [
      Animated.timing(progress, {
        toValue: index + 1,
        duration: fillMs,
        easing: Easing.inOut(Easing.cubic),
        // Percentage widths can't run on the native driver.
        useNativeDriver: false,
      }),
      Animated.delay(index === count - 1 ? tailMs : gapMs),
    ]);

    const run = Animated.sequence(steps);
    run.start();

    // "Done" is a timer, not the animation's completion callback. The callback
    // on a sequence does not reliably fire on web, which left the page parked at
    // a full set of bars with no button and no way forward. The run has a fixed
    // length, so the clock knows exactly when it is over.
    const total = count * fillMs + (count - 1) * gapMs + tailMs;
    const finish = setTimeout(() => onDoneRef.current(), total);

    return () => {
      run.stop();
      clearTimeout(finish);
    };
  }, [progress, count, fillMs, gapMs, tailMs]);

  return progress;
}
