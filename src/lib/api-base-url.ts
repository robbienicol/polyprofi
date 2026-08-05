import Constants from 'expo-constants';

/**
 * Native builds can't fetch a relative "/api/..." path — there's no page origin to resolve
 * against. In dev, reuse the Metro bundler's own host (it already serves API routes
 * alongside the app). In production, EXPO_PUBLIC_API_BASE_URL must point at wherever
 * `eas deploy` published the server bundle (EAS Hosting URL or custom domain).
 */
export function apiBaseUrl(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  if (__DEV__ && hostUri) return `http://${hostUri}`;
  return process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
}
