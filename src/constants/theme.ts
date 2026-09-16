/**
 * Design tokens — the single source of truth for the Pathey palette.
 * See DESIGN.md for the rules; the values below are the only ones allowed.
 *
 *   Brand / CTA      #D9653D
 *   Dark background  #141312
 *   Light background #F7F3EC
 *   Primary text     #1C1A18
 *   Muted text       #756F68
 *   Positive only    #2FA66A
 *   Caution only     #E2A33C
 *   Negative only    #DB4B4B
 *   Neutral / info   #5478D4
 */

import { Platform, type TextStyle } from 'react-native';

export const Colors = {
  light: {
    text: '#1C1A18',
    textSecondary: '#756F68',
    textTertiary: '#A29A90',
    background: '#F7F3EC',
    backgroundElement: '#FFFCF6',
    backgroundElevated: '#FFFFFF',
    backgroundSelected: '#EDE6DA',
    border: '#E3DCD0',
    borderStrong: '#D3CABB',
  },
  dark: {
    // Warm near-black, not pure black — keeps the paper-and-clay feel after dark
    text: '#F7F3EC',
    textSecondary: '#A79F95',
    textTertiary: '#756F68',
    background: '#141312',
    backgroundElement: '#1D1B19',
    backgroundElevated: '#24211E',
    backgroundSelected: '#2C2925',
    border: '#2A2724',
    borderStrong: '#3A3631',
  },
} as const;

/** Brand ramp — use Brand[500] as the primary action / CTA color. */
export const Brand = {
  50: '#FDF1EB',
  100: '#F8DCCE',
  300: '#EBA183',
  500: '#D9653D',
  600: '#BF5230',
  700: '#9C4023',
  glow: '#D9653D',
} as const;

/**
 * Ink used for text and icons sitting on a Brand[500] fill.
 * 5.2:1 against the brand — never put light text on the CTA.
 */
export const OnBrand = '#141312';

/**
 * Semantic colors. Each has exactly one meaning and is used for nothing else:
 * positive = gains/wins, caution = warnings/projections, negative = losses,
 * info = neutral emphasis. Never reach for these for decoration.
 */
export const Semantic = {
  positive: '#2FA66A',
  caution: '#E2A33C',
  negative: '#DB4B4B',
  info: '#5478D4',
} as const;

/** Risk scale: safe → risky. Shared by cards, meters, badges. */
export const RiskScale = ['#2FA66A', '#8FAE4E', '#E2A33C', '#E07D45', '#DB4B4B'] as const;

/**
 * Categorical scale — asset classes, category chips, legend swatches. Drawn
 * from the brand hue and the info blue so a category never borrows the meaning
 * of a semantic color. Order is the assignment order; labels do the rest.
 */
export const CategoryScale = {
  clay: '#D9653D',
  slate: '#5478D4',
  rust: '#9C4023',
  haze: '#93A7DE',
  sand: '#EBA183',
  stone: '#8C857C',
  ink: '#4A443E',
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
    sans: 'var(--font-body)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/**
 * Source Serif 4 — the display face, headings only. Custom fonts on native
 * ignore `fontWeight`, so each weight is its own family and we resolve the
 * family from the weight the style asked for. The serif ships in two weights;
 * anything lighter or heavier lands on the nearest one it has.
 */
export const DisplayFont = {
  '500': 'SourceSerif4_600SemiBold',
  '600': 'SourceSerif4_600SemiBold',
  '700': 'SourceSerif4_700Bold',
  '800': 'SourceSerif4_700Bold',
  '900': 'SourceSerif4_700Bold',
} as const;

/** Public Sans — body, labels, buttons and every figure. */
export const BodyFont = {
  '400': 'PublicSans_400Regular',
  '500': 'PublicSans_500Medium',
  '600': 'PublicSans_600SemiBold',
  '700': 'PublicSans_700Bold',
  '800': 'PublicSans_800ExtraBold',
  '900': 'PublicSans_800ExtraBold',
} as const;

/** Size at or above which text is treated as a heading and gets the display face. */
export const DISPLAY_MIN_SIZE = 18;

export function displayFontFamily(weight?: TextStyle['fontWeight']): string {
  const key = String(weight ?? '700');
  return DisplayFont[key as keyof typeof DisplayFont] ?? DisplayFont['700'];
}

export function bodyFontFamily(weight?: TextStyle['fontWeight']): string {
  const key = String(weight ?? '500');
  return BodyFont[key as keyof typeof BodyFont] ?? BodyFont['500'];
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
