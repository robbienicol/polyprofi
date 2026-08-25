/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform, type TextStyle } from 'react-native';

export const Colors = {
  light: {
    text: '#0A0F0D',
    textSecondary: '#5B6560',
    textTertiary: '#8A938E',
    background: '#FBFCFB',
    backgroundElement: '#FFFFFF',
    backgroundElevated: '#FFFFFF',
    backgroundSelected: '#E6EAE7',
    border: '#E2E7E3',
    borderStrong: '#D2D8D3',
  },
  dark: {
    // Deep green-black, not pure black — gives the app a premium "field" feel
    text: '#F4F7F5',
    textSecondary: '#9BA8A0',
    textTertiary: '#67726B',
    background: '#070B09',
    backgroundElement: '#101613',
    backgroundElevated: '#161D19',
    backgroundSelected: '#1F2823',
    border: '#1C2420',
    borderStrong: '#2A352F',
  },
} as const;

/** Brand green ramp — use Brand[500] as the primary action color. */
export const Brand = {
  50: '#E9FBF0',
  100: '#C9F5DA',
  300: '#5FE39A',
  500: '#22C55E',
  600: '#16A34A',
  700: '#107D39',
  glow: '#22C55E',
} as const;

/** Risk scale: safe → risky. Shared by cards, meters, badges. */
export const RiskScale = ['#22C55E', '#84CC16', '#F59E0B', '#F97316', '#EF4444'] as const;

/** Semantic accents. */
export const Accent = {
  gold: '#F5B43C',
  red: '#EF4444',
  blue: '#3B82F6',
  violet: '#A855F7',
} as const;

/**
 * Typography scale — every variant pairs fontSize with a safe lineHeight
 * (~1.25–1.4×) so text never clips, plus tuned letterSpacing + weight.
 * Source of truth for ThemedText variants; import directly for custom Text.
 */
export const Type = {
  display: { fontSize: 34, lineHeight: 42, letterSpacing: -0.3, fontWeight: '800' },
  title: { fontSize: 28, lineHeight: 36, letterSpacing: -0.3, fontWeight: '800' },
  h1: { fontSize: 22, lineHeight: 29, letterSpacing: -0.2, fontWeight: '700' },
  h2: { fontSize: 18, lineHeight: 25, letterSpacing: -0.2, fontWeight: '700' },
  h3: { fontSize: 16, lineHeight: 22, letterSpacing: -0.1, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22, letterSpacing: 0, fontWeight: '500' },
  bodySm: { fontSize: 13, lineHeight: 19, letterSpacing: 0, fontWeight: '500' },
  label: { fontSize: 12, lineHeight: 16, letterSpacing: 0.4, fontWeight: '700' },
  caption: { fontSize: 11, lineHeight: 15, letterSpacing: 0.2, fontWeight: '500' },
} as const;

/** Multiply fontSize by this when a custom size has no explicit lineHeight. */
export const LINE_HEIGHT_RATIO = 1.3;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

/** Elevation presets — apply with {...Shadow.card}. */
export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  float: {
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/**
 * Plus Jakarta Sans — the display face. Custom fonts on native ignore
 * `fontWeight`, so each weight is its own family and we resolve the family from
 * the weight the style asked for.
 */
export const DisplayFont = {
  '500': 'PlusJakartaSans_500Medium',
  '600': 'PlusJakartaSans_600SemiBold',
  '700': 'PlusJakartaSans_700Bold',
  '800': 'PlusJakartaSans_800ExtraBold',
  '900': 'PlusJakartaSans_800ExtraBold',
} as const;

/** Size at or above which text is treated as a heading and gets the display face. */
export const DISPLAY_MIN_SIZE = 18;

export function displayFontFamily(weight?: TextStyle['fontWeight']): string {
  const key = String(weight ?? '700');
  return DisplayFont[key as keyof typeof DisplayFont] ?? DisplayFont['700'];
}

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
