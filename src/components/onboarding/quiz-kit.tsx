/**
 * The parts every quiz page is built from.
 *
 * Two ideas do most of the work. First, a page opens by *reading back* the
 * previous answer as a spoken line before it asks anything — that is what makes
 * the flow feel answered rather than collected. Second, every page draws its
 * question, helper, and options through the same three primitives, so twelve
 * pages read as one screen changing its mind rather than twelve screens.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Per-word cadence of the spoken line. Paced to reading speed rather than to
 * typing speed — the words are meant to land one at a time, and at 62ms the
 * whole line arrived as one flicker instead of a sentence being said.
 */
const WORD_MS = 105;
/** Held after the last word before anything downstream treats the line as finished. */
const LINE_SETTLE_MS = 320;

export interface Speech {
  words: string[];
  /** How many words have landed so far. */
  spoken: number;
  finished: boolean;
}

/**
 * Reveals a sentence one word at a time.
 *
 * Keyed on `id` rather than on the text: the copy is rebuilt on every keystroke
 * and every slider nudge, and restarting the line each time would make it
 * stutter. A null line resolves immediately as finished, so a page with nothing
 * to read back never waits on it.
 */
export function useSpokenLine(line: string | null | undefined, id: string): Speech {
  const words = useMemo(() => (line ? line.split(' ').filter(Boolean) : []), [line]);
  // Depended on by length rather than by the array: the copy object is rebuilt
  // on every tap, and restarting the line each time would make it stutter.
  const count = words.length;
  const [run, setRun] = useState(() => ({ id, spoken: 0, finished: count === 0 }));

  // Reset during render rather than in an effect: an effect would paint one
  // frame of the previous page's progress before clearing it.
  if (run.id !== id) setRun({ id, spoken: 0, finished: count === 0 });

  useEffect(() => {
    if (count === 0) return;

    let index = 0;
    let settle: ReturnType<typeof setTimeout> | undefined;
    // Every write is guarded on the id it was scheduled for, so a line left
    // over from a page that has already slid away cannot write over the new one.
    const tick = setInterval(() => {
      index += 1;
      setRun((current) => (current.id === id ? { ...current, spoken: index } : current));
      if (index >= count) {
        clearInterval(tick);
        settle = setTimeout(
          () => setRun((current) => (current.id === id ? { ...current, finished: true } : current)),
          LINE_SETTLE_MS
        );
      }
    }, WORD_MS);

    return () => {
      clearInterval(tick);
      if (settle) clearTimeout(settle);
    };
  }, [id, count]);

  return { words, spoken: run.spoken, finished: run.finished };
}

/** The read-back line itself. Each word fades up as it lands. */
export function SpokenLine({ speech, compact }: { speech: Speech; compact: boolean }): React.ReactElement | null {
  const theme = useTheme();
  if (speech.words.length === 0) return null;

  return (
    <View className="flex-row items-start" style={{ gap: 9 }}>
      {/* An accent stroke rather than an avatar: it marks the line as the app
          talking back without putting a mascot on the screen. */}
      <View
        style={{
          width: 3,
          alignSelf: 'stretch',
          minHeight: compact ? 18 : 22,
          borderRadius: Radius.pill,
          backgroundColor: Brand[500],
        }}
      />
      <View className="flex-row flex-wrap" style={{ flex: 1 }}>
        {speech.words.map((word, index) => (
          <Word
            key={`${index}-${word}`}
            word={word}
            visible={index < speech.spoken}
            size={compact ? 13 : 14}
            color={theme.textSecondary}
          />
        ))}
      </View>
    </View>
  );
}

function Word({
  word,
  visible,
  size,
  color,
}: {
  word: string;
  visible: boolean;
  size: number;
  color: string;
}): React.ReactElement {
  const [anim] = useState(() => new Animated.Value(visible ? 1 : 0));

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, visible]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
      }}>
      <ThemedText style={{ fontSize: size, lineHeight: size * 1.45, fontWeight: '600', color }}>
        {`${word} `}
      </ThemedText>
    </Animated.View>
  );
}

export interface PageCopy {
  /** Reads the previous answer back. Omitted on pages that follow nothing worth echoing. */
  ack?: string | null;
  badge?: string;
  title: string;
  helper?: string | null;
}

/** Ack line, optional badge, question, helper — the top of every page. */
export function PageHead({
  copy,
  speech,
  compact,
}: {
  copy: PageCopy;
  speech: Speech;
  compact: boolean;
}): React.ReactElement {
  const theme = useTheme();
  // A short screen can't carry both. The ack is the line written for this
  // person; the helper below it is the same sentence for everybody.
  const helper = compact && copy.ack ? null : copy.helper;

  return (
    <View style={{ gap: compact ? 10 : 13 }}>
      {copy.ack ? <SpokenLine speech={speech} compact={compact} /> : null}
      <View style={{ gap: 7 }}>
        {copy.badge ? (
          <View
            className="flex-row items-center self-start"
            style={{
              gap: 6,
              paddingHorizontal: 9,
              paddingVertical: 4,
              borderRadius: Radius.pill,
              backgroundColor: Brand[500] + '14',
              borderWidth: 1,
              borderColor: Brand[500] + '3D',
            }}>
            <View style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: Brand[500] }} />
            <ThemedText style={{ fontSize: 9.5, fontWeight: '900', color: Brand[500], letterSpacing: 0.8 }}>
              {copy.badge.toUpperCase()}
            </ThemedText>
          </View>
        ) : null}
        <ThemedText
          style={{
            fontSize: compact ? 25 : 29,
            lineHeight: compact ? 30 : 35,
            fontWeight: '800',
            letterSpacing: -0.7,
            color: theme.text,
          }}>
          {copy.title}
        </ThemedText>
        {helper ? (
          <ThemedText
            style={{
              fontSize: compact ? 13 : 14,
              lineHeight: compact ? 18.5 : 20,
              color: theme.textSecondary,
              maxWidth: 360,
            }}>
            {helper}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

/**
 * One option. Two per row by default so six choices are one glance rather than
 * a scroll; `wide` gives a row to itself when the label carries a note.
 */
export function Choice({
  label,
  note,
  emoji,
  selected,
  wide,
  multi,
  onPress,
}: {
  label: string;
  note?: string;
  emoji?: string;
  selected: boolean;
  wide?: boolean;
  multi?: boolean;
  onPress: () => void;
}): React.ReactElement {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={multi ? { checked: selected } : { selected }}
      className="justify-center active:opacity-80"
      style={{
        flexBasis: wide ? '100%' : '47%',
        flexGrow: 1,
        minHeight: note ? 58 : 50,
        paddingHorizontal: 13,
        paddingVertical: 10,
        borderRadius: Radius.md,
        borderWidth: selected ? 2 : 1.5,
        borderColor: selected ? Brand[500] : theme.border,
        backgroundColor: selected ? Brand[500] + '18' : theme.backgroundElement,
      }}>
      <View className="flex-row items-center" style={{ gap: 7 }}>
        {emoji ? <ThemedText style={{ fontSize: 15 }}>{emoji}</ThemedText> : null}
        <ThemedText
          style={{
            flex: 1,
            fontSize: 14,
            lineHeight: 18,
            fontWeight: '700',
            color: selected ? Brand[500] : theme.text,
          }}>
          {label}
        </ThemedText>
      </View>
      {note ? (
        <ThemedText style={{ fontSize: 11.5, lineHeight: 15, marginTop: 3, color: theme.textTertiary }}>
          {note}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

/** The wrapper every set of options sits in, so spacing never drifts page to page. */
export function Options({ children, gap = 8 }: { children: React.ReactNode; gap?: number }): React.ReactElement {
  return (
    <View className="flex-row flex-wrap" style={{ gap }}>
      {children}
    </View>
  );
}

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
