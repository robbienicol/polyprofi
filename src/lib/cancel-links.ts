/**
 * Where to send someone who has decided to cancel a subscription.
 *
 * Returned as an ordered list of candidates, the same shape `tradeUrlsFor` uses, so
 * the opener can fall through when a link does not resolve on the device.
 *
 * Three tiers, in descending order of how much work they save the user:
 *
 *  1. The merchant's own cancellation page, for the ones worth hand-maintaining.
 *     Not the homepage — the account or subscription screen, because "go to spotify.com"
 *     is a step the user could already have taken themselves.
 *  2. Apple's subscription screen, for anything billed through the App Store. Nothing
 *     on the merchant's own site can cancel an Apple-billed subscription, so sending
 *     someone there would be actively wrong.
 *  3. A web search naming the merchant and the word cancel. Honest about being a
 *     fallback, and still better than nothing — but never dressed up as a direct link.
 *
 * The map is deliberately small. A wrong "cancel here" link is worse than an obvious
 * search, so an entry earns its place by being one somebody checked.
 */

/** Matched against the normalized merchant, in order — first hit wins. */
const DIRECT_CANCELLATION_PAGES: readonly { match: RegExp; url: string }[] = [
  { match: /^spotify/, url: 'https://www.spotify.com/account/subscription/' },
  { match: /^netflix/, url: 'https://www.netflix.com/cancelplan' },
  { match: /^hulu/, url: 'https://secure.hulu.com/account' },
  { match: /^disney/, url: 'https://www.disneyplus.com/account/subscription' },
  { match: /^(amazon prime|prime video)/, url: 'https://www.amazon.com/gp/primecentral' },
  { match: /^youtube/, url: 'https://www.youtube.com/paid_memberships' },
  { match: /^(microsoft|msft|xbox)/, url: 'https://account.microsoft.com/services/' },
  { match: /^(google|youtube premium)/, url: 'https://play.google.com/store/account/subscriptions' },
  { match: /^adobe/, url: 'https://account.adobe.com/plans' },
  { match: /^dropbox/, url: 'https://www.dropbox.com/account/plan' },
  { match: /^(openai|chatgpt)/, url: 'https://chat.openai.com/#settings/Subscription' },
  { match: /^anthropic|^claude/, url: 'https://claude.ai/settings/billing' },
  { match: /^cursor/, url: 'https://www.cursor.com/settings' },
  { match: /^github/, url: 'https://github.com/settings/billing' },
  { match: /^(railway)/, url: 'https://railway.app/account/billing' },
  { match: /^vercel/, url: 'https://vercel.com/account/plans' },
  { match: /^notion/, url: 'https://www.notion.so/my-settings/billing' },
  { match: /^figma/, url: 'https://www.figma.com/settings' },
  { match: /^(equinox|planet fitness|24 hour fitness)/, url: 'https://www.google.com/search?q=cancel+gym+membership' },
  { match: /^new york times|^nyt/, url: 'https://myaccount.nytimes.com/seg/subscription' },
  { match: /^peloton/, url: 'https://members.onepeloton.com/preferences/subscriptions' },
  { match: /^audible/, url: 'https://www.audible.com/account/membership' },
];

/**
 * Merchants whose charge is Apple billing the user on someone else's behalf. "Apple
 * Services" and "iTunes" are Apple's own statement labels for exactly that, and the
 * only place any of it can be cancelled is Apple's subscription screen.
 */
const APPLE_BILLED = /^(apple|itunes|apple services|apple\.com)/;

/** Apple's own deep link. Opens Settings → Apple ID → Subscriptions on a device. */
const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

export interface CancellationTarget {
  urls: string[];
  /**
   * How direct the first link is, so the button can say what it actually does rather
   * than promising a cancel page it may not have.
   */
  confidence: 'direct' | 'apple' | 'search';
}

export function cancellationTargetFor(merchant: string): CancellationTarget {
  const normalized = merchant.trim().toLowerCase().replace(/[^a-z0-9. ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const search = `https://duckduckgo.com/?q=${encodeURIComponent(`cancel ${merchant} subscription`)}`;

  // Apple first. A Spotify subscription bought through the App Store still cannot be
  // cancelled on spotify.com, and Apple's own labels are the only signal available here.
  if (APPLE_BILLED.test(normalized)) {
    return { urls: [APPLE_SUBSCRIPTIONS_URL, search], confidence: 'apple' };
  }

  const direct = DIRECT_CANCELLATION_PAGES.find((entry) => entry.match.test(normalized));
  if (direct) {
    // The search stays on as a fallback: account URLs get reorganised, and a dead link
    // should land the user somewhere useful rather than on a 404.
    return { urls: [direct.url, search], confidence: 'direct' };
  }

  return { urls: [search], confidence: 'search' };
}

/** What the button should read. Never promises more than the link can do. */
export function cancellationActionLabel(target: CancellationTarget, merchant: string): string {
  if (target.confidence === 'direct') return `Cancel ${merchant}`;
  if (target.confidence === 'apple') return 'Manage Apple subscriptions';
  return `Find how to cancel ${merchant}`;
}

// ── self-check ──────────────────────────────────────────────────────────────
export function __selfCheck(): void {
  const spotify = cancellationTargetFor('Spotify');
  console.assert(spotify.confidence === 'direct', 'a known merchant gets its own cancellation page');
  console.assert(spotify.urls[0].includes('spotify.com/account'), '…and it is the account page, not the homepage');
  console.assert(spotify.urls.length === 2, 'a search fallback always trails a direct link, in case it has moved');

  console.assert(cancellationTargetFor('SPOTIFY P4612E4D4B').confidence === 'direct', 'matching is case- and noise-insensitive');

  const apple = cancellationTargetFor('Apple Services');
  console.assert(apple.confidence === 'apple', 'an Apple-billed charge routes to Apple, not to the merchant');
  console.assert(apple.urls[0] === 'https://apps.apple.com/account/subscriptions', '…at the subscriptions screen');

  const unknown = cancellationTargetFor('stabmag.com');
  console.assert(unknown.confidence === 'search', 'an unknown merchant falls back to a search');
  console.assert(unknown.urls[0].includes('stabmag.com'), '…naming the merchant');
  console.assert(unknown.urls.length === 1, 'a search has nothing to fall back to');

  console.assert(cancellationActionLabel(spotify, 'Spotify') === 'Cancel Spotify', 'a direct link may promise a cancellation');
  console.assert(
    cancellationActionLabel(unknown, 'stabmag.com') === 'Find how to cancel stabmag.com',
    'a search link says it is a search rather than pretending to cancel',
  );
  console.assert(
    cancellationActionLabel(apple, 'Apple Services') === 'Manage Apple subscriptions',
    'Apple billing is named as such — the user has to pick the right one there',
  );
}
