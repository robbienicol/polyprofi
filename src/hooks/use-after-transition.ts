import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';

/**
 * False until the screen has finished sliding in. Render what is above the fold at
 * once and the rest after this flips: building a whole screen during the push is
 * what made a tap feel like it froze before anything moved. The timer covers a
 * navigator that never sends the event (a cold open, a tab, web).
 */
export function useAfterTransition(fallbackMs = 450): boolean {
  const navigation = useNavigation();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const done = () => setReady(true);
    const unsubscribe = navigation.addListener('transitionEnd' as never, done);
    const timer = setTimeout(done, fallbackMs);
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [fallbackMs, navigation]);
  return ready;
}
