import { Platform, StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { DISPLAY_MIN_SIZE, Fonts, LINE_HEIGHT_RATIO, ThemeColor, Type, displayFontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TextVariant =
  // semantic scale (preferred)
  | 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'bodySm' | 'label' | 'caption'
  // legacy aliases (kept for existing screens)
  | 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';

export type ThemedTextProps = TextProps & {
  type?: TextVariant;
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  // Safety net: any inline fontSize without a lineHeight gets a correct one,
  // so large/bold text with descenders never clips.
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const autoLineHeight =
    flat && typeof flat.fontSize === 'number' && flat.lineHeight == null
      ? Math.round(flat.fontSize * LINE_HEIGHT_RATIO)
      : undefined;

  // Headings wear the display face. Resolved from the *final* size/weight, so
  // inline-styled headers (`fontSize: 34, fontWeight: '800'`) pick it up too.
  // Anything that named its own family — the mono figures — keeps it.
  const resolved = StyleSheet.flatten([styles[type], style]) as TextStyle | undefined;
  const headingFont =
    resolved &&
    resolved.fontFamily == null &&
    typeof resolved.fontSize === 'number' &&
    resolved.fontSize >= DISPLAY_MIN_SIZE
      ? // The weight lives in the family name; leaving fontWeight set on top of it
        // makes Android (and web @font-face matching) synthesize a second bold.
        { fontFamily: displayFontFamily(resolved.fontWeight), fontWeight: 'normal' as const }
      : undefined;

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        styles[type],
        style,
        autoLineHeight != null && { lineHeight: autoLineHeight },
        headingFont,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  // Semantic scale
  display: Type.display,
  h1: Type.h1,
  h2: Type.h2,
  h3: Type.h3,
  body: Type.body,
  bodySm: Type.bodySm,
  label: Type.label,
  caption: Type.caption,

  // Legacy aliases — safe lineHeights (~1.3×), kept so existing screens render unchanged
  default: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  title: { fontSize: 48, lineHeight: 58, fontWeight: '700' },
  subtitle: { fontSize: 32, lineHeight: 42, fontWeight: '600' },
  small: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  smallBold: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  link: { fontSize: 14, lineHeight: 22 },
  linkPrimary: { fontSize: 14, lineHeight: 22, color: '#3c87f7' },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: '700' }) ?? '500',
    fontSize: 12,
    lineHeight: 18,
  },
});
