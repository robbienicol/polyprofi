/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors, RiskTextScale, SemanticText } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** The resolved appearance. `unspecified` and null both mean the light one. */
export function useScheme(): 'light' | 'dark' {
  const scheme = useColorScheme();
  return scheme === 'dark' ? 'dark' : 'light';
}

export function useTheme() {
  return Colors[useScheme()];
}

/**
 * The semantic hues tuned to be read as words rather than seen as fills. Same
 * meanings as `Semantic`, legible at body sizes on this appearance's surfaces.
 * Color a bar or a badge with `Semantic`; color the text with this.
 */
export function useSemanticText(): Record<keyof typeof SemanticText.light, string> {
  return SemanticText[useScheme()];
}

/** The risk ramp as ink, safe → risky, for this appearance. */
export function useRiskTextScale(): readonly string[] {
  return RiskTextScale[useScheme()];
}
