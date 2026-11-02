// Mirrors BRANDING.md / src/constants/theme.ts in the app.
export const C = {
  brand: '#D9653D',
  bg: '#141312',
  bgLight: '#F7F3EC',
  text: '#F7F3EC',
  muted: '#A39B92',
  card: '#1F1D1B',
  border: '#2E2B28',
  positive: '#2FA66A',
  caution: '#E2A33C',
  negative: '#DB4B4B',
} as const;

export const FONT_SERIF = '"Source Serif 4", Georgia, serif';
export const FONT_SANS = '"Public Sans", -apple-system, Helvetica, sans-serif';

export const FPS = 30;
export const W = 1080;
export const H = 1920;
export const s = (seconds: number) => Math.round(seconds * FPS);
