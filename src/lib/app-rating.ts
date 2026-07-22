/**
 * Pops the native in-app rating sheet (App Store / Play Store).
 * No-op if the module isn't installed or the platform can't show it, so callers
 * never need to guard. Requires: npx expo install expo-store-review
 */
export async function requestAppRating(): Promise<void> {
  try {
    const StoreReview = await import('expo-store-review');
    if (await StoreReview.hasAction()) {
      await StoreReview.requestReview();
    }
  } catch {
    // module missing or unavailable on this device — silently skip
  }
}
