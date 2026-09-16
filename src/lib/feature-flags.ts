/**
 * Static feature flags. Flip these to roll a feature out/back without
 * hunting down every call site.
 */
export const FEATURE_FLAGS = {
  /**
   * The $9.99/mo paywall (`/paywall`) currently has no real payment behind
   * it — `useSubscription` just flips a local flag, it does not go through
   * StoreKit/Apple IAP. Keep this off until real in-app-purchase billing is
   * wired up; App Store review will reject a "Subscribe" button that
   * doesn't charge anyone.
   */
  paywallEnabled: false,
} as const;
