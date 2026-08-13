import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getPreferences } from '@/api/client/storage';

// Weekly reminder: Sunday 6pm local. One evergreen, on-brand nudge.
const WEEKLY = {
  weekday: 1, // 1 = Sunday in expo-notifications
  hour: 18,
  minute: 0,
} as const;

const MESSAGES = [
  { title: 'Your weekly routes are ready 💸', body: 'New goals, fresh odds. See the safest way to grow your money this week.' },
  { title: 'Time to make a move 📈', body: 'Set a goal and get your ranked routes — safe to risky, all in one place.' },
  { title: "This week's plays are in 🎯", body: 'Check your highest-probability ways to hit your money goal.' },
];

const IDENTIFIER = 'weekly-reminder';

// Foreground display behavior (so a notification while the app is open still shows).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensurePermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.status === 'granted';
}

/**
 * Ask for the OS permission on demand — used by the Settings toggles so a
 * decline can flip the switch back instead of silently storing an on state
 * that can never deliver anything.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await ensurePermission();
  } catch {
    return false;
  }
}

async function cancelWeeklyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(IDENTIFIER).catch(() => {});
}

/**
 * Reconcile the OS with the weekly-reminder setting. Called when the switch is
 * flipped so turning it off takes effect immediately, not at the next app open.
 */
export async function syncWeeklyReminder(enabled: boolean): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (enabled) await scheduleWeeklyReminder();
    else await cancelWeeklyReminder();
  } catch {
    // notifications unavailable on this device/build — skip silently
  }
}

/**
 * Schedule (idempotently) a once-a-week local reminder to come back and find a
 * safe win. No-op if the user turned the reminder off in Settings, permission is
 * denied, or the platform can't schedule.
 * Safe to call on every app open — it cancels the prior one first so it never stacks.
 */
export async function scheduleWeeklyReminder(): Promise<void> {
  try {
    if (Platform.OS === 'web') return; // local scheduling is native-only
    if (!(await getPreferences()).weeklyReminder) {
      await cancelWeeklyReminder();
      return;
    }
    if (!(await ensurePermission())) return;

    // Clear any prior copy so repeated calls don't pile up duplicates.
    await Notifications.cancelScheduledNotificationAsync(IDENTIFIER).catch(() => {});

    const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    await Notifications.scheduleNotificationAsync({
      identifier: IDENTIFIER,
      content: { title: msg.title, body: msg.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: WEEKLY.weekday,
        hour: WEEKLY.hour,
        minute: WEEKLY.minute,
      },
    });
  } catch {
    // notifications unavailable on this device/build — skip silently
  }
}

/**
 * Fire once when a savings goal is reached. Carries no deep link on purpose: the
 * congratulations screen is presented from persisted goal state, so it shows on
 * the next app open whether the user taps the notification or not.
 */
export async function notifyGoalAchieved(goal: {
  label: string;
  emoji: string;
  targetAmount: number;
}): Promise<void> {
  try {
    if (Platform.OS === 'web') return;
    if (!(await getPreferences()).positionAlerts) return;
    if (!(await ensurePermission())) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${goal.emoji} Goal reached — ${goal.label}!`,
        body: `Your gains just covered your $${goal.targetAmount.toLocaleString()} goal. Open the app to celebrate and pick your next one.`,
      },
      trigger: null,
    });
  } catch {
    // skip silently
  }
}

/** Fire when a tracked bet hits the user's profit goal — nudge them to sell. */
export async function notifySellRecommendation(title: string, body: string): Promise<void> {
  try {
    if (Platform.OS === 'web') return;
    if (!(await getPreferences()).positionAlerts) return;
    if (!(await ensurePermission())) return;

    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  } catch {
    // skip silently
  }
}
