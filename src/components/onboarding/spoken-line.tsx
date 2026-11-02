import React, { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';

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
  const words = line ? line.split(' ').filter(Boolean) : [];
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
