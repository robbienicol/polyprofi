import { CircleAlert, CircleCheck, Clock } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Semantic } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ToastTone = 'success' | 'info' | 'error';

interface ToastMessage {
  id: number;
  message: string;
  tone: ToastTone;
}

/*
 * One toast at a time, from anywhere: a module-level store rather than a context, so
 * a mutation callback or a hook can raise one without being handed a provider value.
 */
let current: ToastMessage | null = null;
let nextId = 1;
const listeners = new Set<(toast: ToastMessage | null) => void>();

function publish(toast: ToastMessage | null): void {
  current = toast;
  listeners.forEach((listener) => listener(toast));
}

export const toast = {
  show(message: string, tone: ToastTone = 'info'): number {
    const id = nextId++;
    publish({ id, message, tone });
    return id;
  },
  success(message: string): number { return toast.show(message, 'success'); },
  error(message: string): number { return toast.show(message, 'error'); },
  /** Clears the toast only if it is still the one this id raised. */
  hide(id?: number): void {
    if (id == null || current?.id === id) publish(null);
  },
};

const VISIBLE_MS = 2_800;
const TONE_ICON = { success: CircleCheck, info: Clock, error: CircleAlert } as const;
const TONE_COLOR = { success: Semantic.positive, info: Semantic.info, error: Semantic.negative } as const;

/** Mounted once at the root. Slides a toast down from under the status bar. */
export function ToastHost(): React.ReactElement | null {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [shown, setShown] = useState<ToastMessage | null>(current);

  useEffect(() => {
    listeners.add(setShown);
    return () => { listeners.delete(setShown); };
  }, []);

  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => toast.hide(shown.id), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [shown]);

  if (!shown) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, alignItems: 'center' }}>
      <Animated.View key={shown.id} entering={FadeInUp.duration(220)} exiting={FadeOutUp.duration(180)} style={{ width: '100%', maxWidth: 480 }}>
        <Pressable
          onPress={() => toast.hide(shown.id)}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          className="flex-row items-center"
          style={{
            gap: 10,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: Radius.lg,
            backgroundColor: theme.text,
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
          }}>
          <Icon icon={TONE_ICON[shown.tone]} size={18} color={TONE_COLOR[shown.tone]} strokeWidth={2.5} />
          <ThemedText style={{ flex: 1, fontSize: 14, fontWeight: '700', color: theme.background }}>{shown.message}</ThemedText>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/**
 * Says something when a wait runs long, so a slow network reads as slow rather than
 * stuck. Raised once per wait, after `afterMs`, and cleared when the wait ends.
 */
export function useSlowToast(waiting: boolean, message = 'Still working — the markets are slow right now…', afterMs = 4_000): void {
  const raised = useRef<number | null>(null);
  useEffect(() => {
    if (!waiting) {
      if (raised.current != null) toast.hide(raised.current);
      raised.current = null;
      return;
    }
    const timer = setTimeout(() => { raised.current = toast.show(message, 'info'); }, afterMs);
    return () => clearTimeout(timer);
  }, [afterMs, message, waiting]);
}
