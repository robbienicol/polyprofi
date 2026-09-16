import { useEffect, useRef } from 'react';

import { requestAppRating } from '@/lib/app-rating';

/**
 * Asks for an App Store rating on the back of good news.
 *
 * The moment matters more than the mechanism. A rating prompt fired at a random
 * launch is a stranger asking a favour; one fired seconds after someone opened a
 * notification saying their money went up is asked of somebody who is, right
 * then, pleased. That is the only place in the app this is called from.
 *
 * The delay lets the destination screen finish painting first — the OS sheet
 * over a half-rendered list reads as a bug, not a request. The ref guard keeps a
 * re-render from asking twice; iOS rate-limits the sheet regardless, but a
 * second call inside one visit would burn that quota silently.
 */
const SETTLE_MS = 1_200;

export function useCelebrationArrival(active: boolean): void {
  const asked = useRef(false);

  useEffect(() => {
    if (!active || asked.current) return;
    asked.current = true;
    const timer = setTimeout(() => { void requestAppRating(); }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [active]);
}
