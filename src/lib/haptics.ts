import { Platform } from 'react-native';

/**
 * One vocabulary of haptics for the whole app, so the same kind of moment always
 * feels the same: `tap` for a press that starts something, `select` for changing
 * a choice, and the three notifications for how something ended.
 *
 * expo-haptics is loaded lazily and every call is fire-and-forget. A JS update
 * that lands on a binary built before the native module was added must not crash
 * on import, and a haptic that fails should never be the reason a tap fails.
 */
interface HapticsModule {
  impactAsync(style: string): Promise<void>;
  selectionAsync(): Promise<void>;
  notificationAsync(type: string): Promise<void>;
  ImpactFeedbackStyle: Record<'Light' | 'Medium' | 'Heavy' | 'Soft' | 'Rigid', string>;
  NotificationFeedbackType: Record<'Success' | 'Warning' | 'Error', string>;
}

let cached: HapticsModule | null | undefined;

function haptics(): HapticsModule | null {
  if (cached !== undefined) return cached;
  if (Platform.OS === 'web') return (cached = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-haptics') as HapticsModule;
  } catch {
    cached = null;
  }
  return cached;
}

function run(call: (module: HapticsModule) => Promise<void>): void {
  const module = haptics();
  if (!module) return;
  call(module).catch(() => undefined);
}

export const Haptic = {
  /** A press that kicks something off: a CTA, an add button. */
  tap: (): void => run((m) => m.impactAsync(m.ImpactFeedbackStyle.Light)),
  /** A heavier press, for the one commit on a screen. */
  press: (): void => run((m) => m.impactAsync(m.ImpactFeedbackStyle.Medium)),
  /** Changing a choice: a segment, a toggle, a chip. */
  select: (): void => run((m) => m.selectionAsync()),
  success: (): void => run((m) => m.notificationAsync(m.NotificationFeedbackType.Success)),
  warning: (): void => run((m) => m.notificationAsync(m.NotificationFeedbackType.Warning)),
  error: (): void => run((m) => m.notificationAsync(m.NotificationFeedbackType.Error)),
};
