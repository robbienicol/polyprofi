import type { ScrollViewProps } from 'react-native';

/**
 * Scroll behaviour for any screen that can open the acquire form. Its amount field
 * autofocuses inline — partway down the routes list, or mid-page on a route detail — so
 * the keyboard arrives over content that was already laid out and lands on top of the
 * very input it just opened.
 *
 * `automaticallyAdjustKeyboardInsets` insets the scroll view so the focused field can be
 * scrolled clear of the keyboard instead of sitting behind it. `keyboardShouldPersistTaps`
 * matters just as much: without it the first tap on "Open <venue>" is swallowed dismissing
 * the keyboard, so confirming an acquisition takes two taps.
 */
export const KEYBOARD_AWARE_SCROLL_PROPS = {
  automaticallyAdjustKeyboardInsets: true,
  keyboardShouldPersistTaps: 'handled',
  keyboardDismissMode: 'interactive',
} satisfies Partial<ScrollViewProps>;
